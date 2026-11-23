import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowUpRight, RefreshCw, Search } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { clusterApi } from '../services/api'
import { useNamespace } from '../context/NamespaceContext'
import type { ClusterEventResponse } from '../types/cluster'

export function EventsPage() {
    const { namespace, setNamespace } = useNamespace()
    const navigate = useNavigate()

    const [events, setEvents] = useState<ClusterEventResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [kindFilter, setKindFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [search, setSearch] = useState('')

    const loadEvents = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)
        try {
            const data = await clusterApi.getClusterEvents(
                {
                    namespace: namespace || undefined,
                    kind: kindFilter || undefined,
                    type: typeFilter || undefined,
                    search: search.trim() || undefined,
                },
                signal,
            )
            setEvents(data)
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Unable to load cluster events')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [namespace, kindFilter, typeFilter, search])

    useEffect(() => {
        const controller = new AbortController()
        void loadEvents(controller.signal)
        return () => controller.abort()
    }, [loadEvents])

    const availableKinds = useMemo(() => {
        const set = new Set<string>()
        for (const ev of events) {
            if (ev.involvedKind) set.add(ev.involvedKind)
        }
        return ['Node', 'Pod', 'Deployment', 'StatefulSet', 'ReplicaSet', 'Service', 'Ingress', 'Namespace', ...Array.from(set)].filter(
            (v, idx, arr) => arr.indexOf(v) === idx,
        )
    }, [events])

    const handleNavigateToResource = (ev: ClusterEventResponse) => {
        if (ev.involvedNamespace) {
            setNamespace(ev.involvedNamespace)
        }
        switch (ev.involvedKind) {
            case 'Node':
                navigate('/nodes')
                break
            case 'Pod':
                navigate('/pods')
                break
            case 'Deployment':
            case 'ReplicaSet':
                navigate('/workloads')
                break
            case 'StatefulSet':
                navigate('/statefulsets')
                break
            case 'Namespace':
                navigate('/namespaces')
                break
            case 'Service':
            case 'Ingress':
                navigate('/services')
                break
            default:
                navigate('/topology')
                break
        }
    }

    return (
        <div className="space-y-7">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                        Observe / Events
                    </p>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
                        Cluster Events
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Inspect Kubernetes events across nodes, workloads, and namespaces {namespace ? `in ${namespace}` : 'across all namespaces'}.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadEvents()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50 sm:self-auto"
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </section>

            <div className="flex flex-wrap items-center gap-2.5">
                <select
                    aria-label="Filter by resource kind"
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#0d1523] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-300/40"
                >
                    <option value="">All resource kinds</option>
                    {availableKinds.map((k) => (
                        <option key={k} value={k}>{k}</option>
                    ))}
                </select>

                <select
                    aria-label="Filter by event type"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#0d1523] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-300/40"
                >
                    <option value="">All event types</option>
                    <option value="Normal">Normal</option>
                    <option value="Warning">Warning</option>
                </select>

                <label className="relative min-w-52 flex-1 sm:max-w-sm">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by reason, message, or resource..."
                        className="w-full rounded-lg border border-white/10 bg-[#0d1523] py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                    />
                </label>
            </div>

            <RequestState loading={loading && events.length === 0} error={error && events.length === 0 ? error : null} onRetry={() => void loadEvents()}>
                <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1523]">
                    <div className="flex items-center justify-between border-b border-white/[0.07] p-4">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-cyan-200" />
                            <h2 className="text-sm font-semibold text-slate-100">Recorded events</h2>
                            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">
                {events.length} total
              </span>
                        </div>
                    </div>

                    {events.length === 0 ? (
                        <div className="px-5 py-14 text-center">
                            <p className="text-sm font-medium text-slate-300">No events found</p>
                            <p className="mt-1 text-xs text-slate-500">
                                Try adjusting the namespace, resource kind, event type, or search filter.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1040px] text-left text-xs">
                                <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Type</th>
                                    <th className="px-4 py-3 font-semibold">Reason</th>
                                    <th className="px-4 py-3 font-semibold">Involved Resource</th>
                                    <th className="px-4 py-3 font-semibold">Message</th>
                                    <th className="px-4 py-3 font-semibold">Source</th>
                                    <th className="px-4 py-3 font-semibold">Count</th>
                                    <th className="px-4 py-3 font-semibold">Time</th>
                                    <th className="px-4 py-3 font-semibold">View</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.055]">
                                {events.map((ev, idx) => (
                                    <tr key={ev.uid ?? `${ev.reason ?? 'ev'}-${idx}`} className="transition hover:bg-white/[0.03]">
                                        <td className="px-4 py-3.5">
                                            <StatusBadge status={ev.type === 'Warning' ? 'Warning' : ev.type || 'Normal'} />
                                        </td>
                                        <td className="px-4 py-3.5 font-semibold text-slate-200">{ev.reason || '—'}</td>
                                        <td className="px-4 py-3.5 text-slate-300">
                                            <div className="font-mono text-[11px]">{ev.involvedKind || 'Resource'}/{ev.involvedName || '—'}</div>
                                            <div className="text-[10px] text-slate-500">{ev.involvedNamespace || 'Cluster scoped'}</div>
                                        </td>
                                        <td className="max-w-md px-4 py-3.5 text-slate-300">{ev.message || 'No message'}</td>
                                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">{ev.sourceComponent || '—'}</td>
                                        <td className="px-4 py-3.5 tabular-nums text-slate-400">{ev.count}</td>
                                        <td className="px-4 py-3.5 text-[11px] text-slate-400">
                                            {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <button
                                                type="button"
                                                onClick={() => handleNavigateToResource(ev)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-cyan-200 transition hover:bg-white/[0.07]"
                                            >
                                                Open <ArrowUpRight size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </RequestState>
        </div>
    )
}