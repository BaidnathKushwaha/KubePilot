import { useCallback, useEffect, useMemo, useState } from 'react'
import { Network, RefreshCw, Search } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { clusterApi } from '../services/api'
import { useNamespace } from '../context/NamespaceContext'
import type { ServiceTrafficResponse } from '../types/traffic'

export function ServicesPage() {
    const { namespace } = useNamespace()
    const [data, setData] = useState<ServiceTrafficResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const loadTraffic = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)
        try {
            setData(await clusterApi.getServiceTraffic(namespace || undefined, signal))
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Unable to load service endpoints')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [namespace])

    useEffect(() => {
        const controller = new AbortController()
        void loadTraffic(controller.signal)
        return () => controller.abort()
    }, [loadTraffic])

    const filteredServices = useMemo(() => {
        const list = data?.services ?? []
        const q = search.trim().toLowerCase()
        if (!q) return list
        return list.filter((svc) =>
            [svc.name, svc.namespace, svc.type ?? '', svc.clusterIP ?? '', ...svc.matchedWorkloads]
                .some((val) => val.toLowerCase().includes(q)),
        )
    }, [data, search])

    const totals = useMemo(() => {
        const list = data?.services ?? []
        return list.reduce(
            (acc, svc) => {
                acc.ready += svc.readyEndpointCount
                acc.unready += svc.unreadyEndpointCount
                return acc
            },
            { ready: 0, unready: 0 },
        )
    }, [data])

    return (
        <div className="space-y-7">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                        Workspace / Networking
                    </p>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
                        Services & Endpoint Distribution
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Discovered Kubernetes Services, Ingress routes, EndpointSlice readiness, and matched workloads {namespace ? `in ${namespace}` : 'across all namespaces'}.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadTraffic()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50 sm:self-auto"
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </section>

            <RequestState loading={loading && !data} error={error && !data ? error : null} onRetry={() => void loadTraffic()}>
                {data && (
                    <>
                        <div role="status" className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-3 text-xs text-slate-300">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                    <strong className="text-cyan-200">Discovered Traffic Topology</strong> (K8s Services, Ingresses & EndpointSlices) ·{' '}
                                    Measured request-rate telemetry: <strong>{data.trafficRateTelemetryAvailable ? 'Available' : 'Not Available'}</strong>
                                </span>
                                <span className="tabular-nums text-[11px] text-slate-400">
                                    {data.services.length} service(s) · {totals.ready} ready / {totals.unready} unready endpoint(s)
                                </span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{data.trafficTelemetryNote}</p>
                        </div>

                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search services or workloads..."
                                className="w-full rounded-lg border border-white/10 bg-[#0d1523] py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                            />
                        </div>

                        {filteredServices.length === 0 ? (
                            <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-12 text-center text-xs text-slate-500">
                                No Services found in the current filter.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredServices.map((svc) => (
                                    <article key={`${svc.namespace}/${svc.name}`} className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5 text-xs">
                                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-3.5">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                                                    <Network size={16} />
                                                </span>
                                                <div>
                                                    <h2 className="text-sm font-semibold text-white">{svc.name}</h2>
                                                    <p className="text-[11px] text-slate-400">
                                                        {svc.namespace} · Type: {svc.type || 'ClusterIP'} · ClusterIP: <span className="font-mono">{svc.clusterIP || 'None'}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <StatusBadge status={svc.readyEndpointCount > 0 ? `${svc.readyEndpointCount} Ready` : 'No Ready Endpoints'} />
                                                {svc.unreadyEndpointCount > 0 && (
                                                    <StatusBadge status={`${svc.unreadyEndpointCount} Unready`} />
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500">Matched Workloads</p>
                                                <p className="mt-1 text-slate-200">{svc.matchedWorkloads.join(', ') || 'None matched'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500">Ingress Hosts</p>
                                                <p className="mt-1 text-slate-200">{svc.ingressHosts.join(', ') || 'None'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500">Ports</p>
                                                <p className="mt-1 font-mono text-[11px] text-slate-300">
                                                    {svc.ports.map((p) => `${p.port}->${p.targetPort ?? p.port}/${p.protocol ?? 'TCP'}`).join(', ') || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                EndpointSlice Targets ({svc.endpoints.length})
                                            </p>
                                            {svc.endpoints.length === 0 ? (
                                                <p className="text-[11px] text-slate-500">No EndpointSlice entries reported for this Service.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    {svc.endpoints.map((ep, idx) => (
                                                        <div key={`${ep.sliceName}-${ep.address}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-slate-950/35 px-3 py-2 text-[11px]">
                                                            <div className="min-w-0">
                                                                <p className="truncate font-mono text-slate-200">{ep.address}</p>
                                                                <p className="truncate text-[10px] text-slate-500">
                                                                    {ep.targetKind && ep.targetName ? `${ep.targetKind}/${ep.targetName}` : 'Unreferenced endpoint'} · {ep.sliceName}
                                                                </p>
                                                                {ep.trafficRateNote && (
                                                                    <p className="truncate text-[10px] text-slate-600">{ep.trafficRateNote}</p>
                                                                )}
                                                            </div>
                                                            <StatusBadge status={ep.ready ? 'Ready' : 'NotReady'} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </RequestState>
        </div>
    )
}