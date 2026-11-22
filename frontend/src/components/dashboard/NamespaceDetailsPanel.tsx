import { useEffect, useState } from 'react'
import { FolderOpen, KeyRound, RefreshCw, Shield, X } from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { NamespaceDetailResponse } from '../../types/cluster'
import { StatusBadge } from './StatusBadge'

interface NamespaceDetailsPanelProps {
    namespaceName: string
    onClose: () => void
}

export function NamespaceDetailsPanel({ namespaceName, onClose }: NamespaceDetailsPanelProps) {
    const [details, setDetails] = useState<NamespaceDetailResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadDetails = async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)
        try {
            const res = await clusterApi.getNamespaceDetails(namespaceName, signal)
            setDetails(res)
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Failed to load namespace details')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        void loadDetails(controller.signal)
        return () => controller.abort()
    }, [namespaceName])

    return (
        <div
            className="fixed inset-0 z-[80] flex justify-end bg-slate-950/65 backdrop-blur-[2px]"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Namespace details"
                className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/[0.08] bg-[#0b1220] p-5 shadow-2xl sm:p-7"
            >
                <header className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#0b1220]/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:-mt-7 sm:px-7">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            Kubernetes / Namespace Inspection
                        </p>
                        <h2 className="mt-2 break-all text-lg font-semibold text-white">{namespaceName}</h2>
                        {details && (
                            <div className="mt-2">
                                <StatusBadge status={details.status} />
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            disabled={loading}
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </header>

                {loading && !details && (
                    <div className="py-16 text-center text-xs text-slate-400">
                        <RefreshCw size={18} className="mx-auto animate-spin text-cyan-300" />
                        <p className="mt-2">Loading namespace resources...</p>
                    </div>
                )}

                {error && !details && (
                    <div className="mt-6 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-4 text-xs text-red-300">
                        {error}
                    </div>
                )}

                {details && (
                    <div className="space-y-5 pb-8 pt-4 text-xs">
                        <section className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-4">
                            <div><p className="text-slate-500">Pods</p><p className="mt-1 text-base font-semibold text-white">{details.pods.length}</p></div>
                            <div><p className="text-slate-500">Deployments</p><p className="mt-1 text-base font-semibold text-white">{details.deployments.length}</p></div>
                            <div><p className="text-slate-500">StatefulSets</p><p className="mt-1 text-base font-semibold text-white">{details.statefulSets.length}</p></div>
                            <div><p className="text-slate-500">Services</p><p className="mt-1 text-base font-semibold text-white">{details.services.length}</p></div>
                        </section>

                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-wider text-slate-300">
                                <FolderOpen size={14} className="text-cyan-300" />
                                Workloads & Config
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-3">
                                    <p className="text-slate-400">DaemonSets ({details.daemonSets.length})</p>
                                    <p className="mt-1 text-[11px] text-slate-300">
                                        {details.daemonSets.map((d) => d.name).join(', ') || 'None'}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-3">
                                    <p className="text-slate-400">ConfigMaps ({details.configMaps.length})</p>
                                    <p className="mt-1 text-[11px] text-slate-300">
                                        {details.configMaps.map((c) => c.name).join(', ') || 'None'}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-3">
                                    <p className="flex items-center gap-1 text-slate-400"><KeyRound size={12} /> Secrets Metadata ({details.secretsMetadataOnly.length})</p>
                                    <p className="mt-1 text-[11px] text-slate-300">
                                        {details.secretsMetadataOnly.map((s) => `${s.name} (${s.dataKeyCount} keys)`).join(', ') || 'None'}
                                    </p>
                                    <p className="mt-1 text-[10px] text-slate-500">Secret values are never exposed.</p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-wider text-slate-300">
                                <Shield size={14} className="text-cyan-300" />
                                ResourceQuotas ({details.resourceQuotas.length}) & LimitRanges ({details.limitRanges.length})
                            </div>
                            {details.resourceQuotas.length === 0 && details.limitRanges.length === 0 ? (
                                <p className="text-slate-500">No ResourceQuotas or LimitRanges configured in this namespace.</p>
                            ) : (
                                <div className="space-y-2">
                                    {details.resourceQuotas.map((q) => (
                                        <div key={q.name} className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2.5 text-[11px]">
                                            <p className="font-semibold text-slate-200">Quota: {q.name}</p>
                                            <p className="mt-0.5 text-slate-400">Hard: {JSON.stringify(q.hard)} · Used: {JSON.stringify(q.used)}</p>
                                        </div>
                                    ))}
                                    {details.limitRanges.map((lr) => (
                                        <div key={lr.name} className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2.5 text-[11px] text-slate-300">
                                            LimitRange: {lr.name} ({lr.itemCount} rule item(s))
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="mb-2 font-semibold uppercase tracking-wider text-slate-300">
                                Recent Namespace Events ({details.events.length})
                            </p>
                            {details.events.length === 0 ? (
                                <p className="text-slate-500">No events in this namespace.</p>
                            ) : (
                                <div className="max-h-48 space-y-2 overflow-y-auto">
                                    {details.events.slice(0, 20).map((ev, i) => (
                                        <div key={i} className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2.5 text-[11px]">
                                            <span className="font-semibold text-slate-200">{ev.reason || 'Event'}</span>: {ev.message || 'No message'}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </aside>
        </div>
    )
}