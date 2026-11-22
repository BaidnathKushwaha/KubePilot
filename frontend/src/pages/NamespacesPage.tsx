import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderPlus, Layers, RefreshCw, Search } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { NamespaceCreateModal } from '../components/dashboard/NamespaceCreateModal'
import { NamespaceDetailsPanel } from '../components/dashboard/NamespaceDetailsPanel'
import { clusterApi } from '../services/api'
import { useNamespace } from '../context/NamespaceContext'
import type { NamespaceOverviewItem } from '../types/cluster'

export function NamespacesPage() {
    const [items, setItems] = useState<NamespaceOverviewItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedNs, setSelectedNs] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const { retryNamespaces } = useNamespace()

    const loadNamespaces = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)
        try {
            setItems(await clusterApi.getNamespaceOverview(signal))
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Unable to load namespaces')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        void loadNamespaces(controller.signal)
        return () => controller.abort()
    }, [loadNamespaces])

    const filtered = useMemo(
        () => items.filter((ns) =>
            [ns.name, ns.status].some((v) => v.toLowerCase().includes(search.toLowerCase())),
        ),
        [items, search],
    )

    return (
        <div className="space-y-7">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                        Workspace / Cluster Scoped
                    </p>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
                        Namespaces
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Inspect namespace workloads, resource quotas, and create new isolated namespaces.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                    >
                        <FolderPlus size={14} /> Create Namespace
                    </button>
                    <button
                        type="button"
                        onClick={() => void loadNamespaces()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </section>

            <RequestState loading={loading && items.length === 0} error={error && items.length === 0 ? error : null} onRetry={() => void loadNamespaces()}>
                <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1523]">
                    <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-cyan-200" />
                            <h2 className="text-sm font-semibold text-slate-100">Cluster namespaces</h2>
                            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">{items.length} total</span>
                        </div>
                        <label className="relative block sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search namespaces..."
                                className="w-full rounded-lg border border-white/10 bg-slate-950/40 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                            />
                        </label>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left text-xs">
                            <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-5 py-3 font-semibold">Namespace</th>
                                <th className="px-5 py-3 font-semibold">Status</th>
                                <th className="px-5 py-3 font-semibold">Pods</th>
                                <th className="px-5 py-3 font-semibold">Deployments</th>
                                <th className="px-5 py-3 font-semibold">Services</th>
                                <th className="px-5 py-3 font-semibold">Quotas</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.055]">
                            {filtered.map((ns) => (
                                <tr key={ns.name} className="cursor-pointer transition hover:bg-white/[0.045]" onClick={() => setSelectedNs(ns.name)}>
                                    <td className="px-5 py-4 font-medium text-slate-200">{ns.name}</td>
                                    <td className="px-5 py-4"><StatusBadge status={ns.status} /></td>
                                    <td className="px-5 py-4 tabular-nums text-slate-300">{ns.podCount}</td>
                                    <td className="px-5 py-4 tabular-nums text-slate-300">{ns.deploymentCount}</td>
                                    <td className="px-5 py-4 tabular-nums text-slate-300">{ns.serviceCount}</td>
                                    <td className="px-5 py-4 text-slate-400">{ns.resourceQuotas.length > 0 ? `${ns.resourceQuotas.length} quota(s)` : 'None'}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </RequestState>

            {selectedNs && (
                <NamespaceDetailsPanel namespaceName={selectedNs} onClose={() => setSelectedNs(null)} />
            )}

            {createOpen && (
                <NamespaceCreateModal
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => {
                        void loadNamespaces()
                        retryNamespaces()
                    }}
                />
            )}
        </div>
    )
}