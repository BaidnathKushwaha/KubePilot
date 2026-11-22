import { useEffect, useState } from 'react'
import {
    Activity,
    AlertTriangle,
    Boxes,
    CheckCircle2,
    Clock,
    Cpu,
    Lock,
    RefreshCw,
    Server,
    ShieldAlert,
    Tag,
    Unlock,
    X,
} from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { KubernetesPod, NodeDetailResponse, NodeOperationResponse } from '../../types/cluster'
import { StatusBadge } from './StatusBadge'

interface NodeDetailsPanelProps {
    nodeName: string
    initialPods?: KubernetesPod[]
    onClose: () => void
    onNodeUpdated?: () => void
    onOpenDrain?: () => void
}

function formatBytes(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable'
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MiB`
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`
    return `${value} B`
}

function formatCpu(milliCores: number | null | undefined): string {
    if (milliCores === null || milliCores === undefined || !Number.isFinite(milliCores)) return 'Unavailable'
    return milliCores >= 1000 ? `${(milliCores / 1000).toFixed(2)} cores` : `${milliCores} m`
}

export function NodeDetailsPanel({
                                     nodeName,
                                     initialPods = [],
                                     onClose,
                                     onNodeUpdated,
                                     onOpenDrain,
                                 }: NodeDetailsPanelProps) {
    const [details, setDetails] = useState<NodeDetailResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [actionBusy, setActionBusy] = useState(false)
    const [actionResult, setActionResult] = useState<NodeOperationResponse | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    const loadDetails = async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)
        try {
            const res = await clusterApi.getNodeDetails(nodeName, signal)
            setDetails(res)
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Failed to load node details')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }

    useEffect(() => {
        setActionResult(null)
        setActionError(null)
        const controller = new AbortController()
        void loadDetails(controller.signal)
        return () => controller.abort()
    }, [nodeName])

    const node = details?.node
    const pods = details?.scheduledPods ?? initialPods
    const isUnschedulable =
        details?.schedulingStatus === 'UNSCHEDULABLE' || Boolean(node?.unschedulable)

    const handleCordon = async () => {
        const confirmed = window.confirm(
            `Cordon node "${nodeName}"?\n\nNew pods will not be scheduled onto this node. Existing running pods on "${nodeName}" will continue running undisturbed.`,
        )
        if (!confirmed) return

        setActionBusy(true)
        setActionError(null)
        setActionResult(null)
        try {
            const res = await clusterApi.cordonNode(nodeName)
            setActionResult(res)
            await loadDetails()
            onNodeUpdated?.()
        } catch (cause) {
            setActionError(cause instanceof Error ? cause.message : 'Failed to cordon node')
        } finally {
            setActionBusy(false)
        }
    }

    const handleUncordon = async () => {
        const confirmed = window.confirm(
            `Uncordon node "${nodeName}"?\n\nNew pods will be allowed to schedule onto this node again. Existing pods on other nodes will not be automatically moved or restarted.`,
        )
        if (!confirmed) return

        setActionBusy(true)
        setActionError(null)
        setActionResult(null)
        try {
            const res = await clusterApi.uncordonNode(nodeName)
            setActionResult(res)
            await loadDetails()
            onNodeUpdated?.()
        } catch (cause) {
            setActionError(cause instanceof Error ? cause.message : 'Failed to uncordon node')
        } finally {
            setActionBusy(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[80] flex justify-end bg-slate-950/65 backdrop-blur-[2px]"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !actionBusy) onClose()
            }}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Node inspection"
                className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/[0.08] bg-[#0b1220] p-5 shadow-2xl sm:p-7"
            >
                <header className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#0b1220]/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:-mt-7 sm:px-7">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            Kubernetes / Node Inspection
                        </p>
                        <h2 className="mt-2 break-all text-lg font-semibold text-white">{nodeName}</h2>
                        {node && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500">Health:</span>
                                <StatusBadge status={node.status} />
                                <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">Scheduling:</span>
                                <StatusBadge status={isUnschedulable ? 'Unschedulable' : 'Schedulable'} />
                            </div>
                        )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            disabled={loading || actionBusy}
                            aria-label="Refresh node details"
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={actionBusy}
                            aria-label="Close node details"
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </header>

                {loading && !details && (
                    <div className="py-16 text-center">
                        <RefreshCw size={20} className="mx-auto animate-spin text-cyan-300" />
                        <p className="mt-3 text-sm text-slate-400">Loading node details...</p>
                    </div>
                )}

                {error && !details && (
                    <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4">
                        <p className="text-sm text-red-300">Failed to load node details</p>
                        <p className="mt-1.5 text-xs text-slate-400">{error}</p>
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {node && (
                    <div className="space-y-6 pb-8 pt-4">
                        {/* Scheduling & Maintenance Operations */}
                        <section className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                                    {isUnschedulable ? (
                                        <Lock size={14} className="text-amber-300" />
                                    ) : (
                                        <Unlock size={14} className="text-emerald-300" />
                                    )}
                                    Node Scheduling & Maintenance
                                </div>
                                <span className="text-[11px] text-slate-400">
                                    {isUnschedulable
                                        ? 'Cordoned — new workloads blocked'
                                        : 'Schedulable — accepting new workloads'}
                                </span>
                            </div>

                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                Cordoning marks the node unschedulable while preserving currently running pods.
                                Uncordoning restores scheduling eligibility without relocating existing pods.
                                Draining cordons the node and evicts controller-managed pods safely.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handleCordon()}
                                    disabled={actionBusy || isUnschedulable}
                                    className="inline-flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3.5 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Lock size={14} />
                                    {actionBusy && !isUnschedulable ? 'Cordoning...' : 'Cordon Node'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => void handleUncordon()}
                                    disabled={actionBusy || !isUnschedulable}
                                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Unlock size={14} />
                                    {actionBusy && isUnschedulable ? 'Uncordoning...' : 'Uncordon Node'}
                                </button>

                                {onOpenDrain && (
                                    <button
                                        type="button"
                                        onClick={onOpenDrain}
                                        disabled={actionBusy}
                                        className="inline-flex items-center gap-2 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3.5 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                                    >
                                        <ShieldAlert size={14} />
                                        Drain Node
                                    </button>
                                )}
                            </div>

                            {actionResult && (
                                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.05] p-3 text-xs text-emerald-200">
                                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                                    <div>
                                        <p className="font-semibold">
                                            {actionResult.operation}: {actionResult.status} ({actionResult.schedulingStatus})
                                        </p>
                                        <p className="mt-1 text-slate-300">{actionResult.message}</p>
                                        <p className="mt-1 text-[10px] text-slate-500">
                                            Audit ID: {actionResult.auditId} · {new Date(actionResult.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {actionError && (
                                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-400/25 bg-red-400/[0.05] p-3 text-xs text-red-300">
                                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
                                    <p className="break-all">{actionError}</p>
                                </div>
                            )}
                        </section>

                        {/* System & Scheduling */}
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                                <Server size={14} className="text-cyan-300" />
                                System & Scheduling
                            </div>
                            <dl className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <dt className="text-slate-500">Health Status</dt>
                                    <dd className="mt-1 text-slate-200">{node.status}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Scheduling Status</dt>
                                    <dd className="mt-1 text-slate-200">
                                        {details?.schedulingStatus ?? (node.unschedulable ? 'UNSCHEDULABLE' : 'SCHEDULABLE')}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Internal IP</dt>
                                    <dd className="mt-1 font-mono text-slate-200">{node.internalIP || 'Not available'}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Kubernetes Version</dt>
                                    <dd className="mt-1 text-slate-200">{node.kubernetesVersion || 'Not available'}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Operating System</dt>
                                    <dd className="mt-1 text-slate-200">{node.operatingSystem || 'Not available'}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">OS Image</dt>
                                    <dd className="mt-1 text-slate-200">{node.osImage || 'Not available'}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-slate-500">Container Runtime</dt>
                                    <dd className="mt-1 font-mono text-slate-200">{node.containerRuntime || 'Not available'}</dd>
                                </div>
                            </dl>
                        </section>

                        {/* Capacity vs Allocatable vs Usage */}
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                                <Cpu size={14} className="text-cyan-300" />
                                Capacity, Allocatable & Usage
                            </div>
                            <dl className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <dt className="text-slate-500">CPU Capacity / Allocatable</dt>
                                    <dd className="mt-1 tabular-nums text-slate-200">
                                        {node.capacity?.cpu ?? '—'} / {node.allocatable?.cpu ?? '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Current CPU Usage</dt>
                                    <dd className="mt-1 tabular-nums text-cyan-200">{formatCpu(details?.cpuUsageMilliCores)}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Memory Capacity / Allocatable</dt>
                                    <dd className="mt-1 tabular-nums text-slate-200">
                                        {node.capacity?.memory ?? '—'} / {node.allocatable?.memory ?? '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Current Memory Usage</dt>
                                    <dd className="mt-1 tabular-nums text-cyan-200">{formatBytes(details?.memoryUsageBytes)}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-slate-500">Pod Capacity / Scheduled Pods</dt>
                                    <dd className="mt-1 tabular-nums text-slate-200">
                                        {node.podCapacity ?? node.capacity?.pods ?? '—'} capacity · {pods.length} scheduled
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        {/* Conditions */}
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                                <Activity size={14} className="text-cyan-300" />
                                Conditions ({node.conditions?.length ?? 0})
                            </div>
                            {!node.conditions || node.conditions.length === 0 ? (
                                <p className="text-xs text-slate-500">No conditions reported.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {node.conditions.map((c) => (
                                        <div key={c.type} className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-3 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium text-slate-200">{c.type}</span>
                                                <StatusBadge status={c.status} />
                                            </div>
                                            {c.reason && <p className="mt-1 text-[11px] text-slate-400">Reason: {c.reason}</p>}
                                            {c.message && <p className="mt-1 text-[11px] text-slate-500">{c.message}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Taints & Labels */}
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                                <Tag size={14} className="text-cyan-300" />
                                Taints & Labels
                            </div>
                            <div className="space-y-3 text-xs">
                                <div>
                                    <p className="text-[11px] text-slate-500">Taints ({node.taints?.length ?? 0})</p>
                                    {!node.taints || node.taints.length === 0 ? (
                                        <p className="mt-1 text-slate-400">None</p>
                                    ) : (
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {node.taints.map((t, idx) => (
                                                <span key={`${t.key}-${idx}`} className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1 font-mono text-[11px] text-amber-200">
                                                    {t.key}{t.value ? `=${t.value}` : ''}:{t.effect ?? 'NoSchedule'}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] text-slate-500">Labels ({Object.keys(node.labels ?? {}).length})</p>
                                    {!node.labels || Object.keys(node.labels).length === 0 ? (
                                        <p className="mt-1 text-slate-400">None</p>
                                    ) : (
                                        <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/[0.05] bg-slate-950/30 p-2.5 font-mono text-[11px]">
                                            {Object.entries(node.labels).map(([k, v]) => (
                                                <div key={k} className="truncate text-slate-300">
                                                    <span className="text-slate-500">{k}=</span>{v}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Scheduled Pods */}
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                                <Boxes size={14} className="text-cyan-300" />
                                Scheduled Pods ({pods.length})
                            </div>
                            {pods.length === 0 ? (
                                <p className="text-xs text-slate-500">No pods currently scheduled on this node.</p>
                            ) : (
                                <div className="max-h-52 space-y-2 overflow-y-auto">
                                    {pods.map((pod) => (
                                        <div key={`${pod.namespace}/${pod.name}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-slate-950/30 px-3 py-2 text-xs">
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-slate-200">{pod.name}</p>
                                                <p className="text-[10px] text-slate-500">{pod.namespace}</p>
                                            </div>
                                            <StatusBadge status={pod.status} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Node Events */}
                        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                                <Clock size={14} className="text-cyan-300" />
                                Node Events ({details?.events?.length ?? 0})
                            </div>
                            {!details?.events || details.events.length === 0 ? (
                                <p className="text-xs text-slate-500">No node-scoped events recorded.</p>
                            ) : (
                                <div className="max-h-52 space-y-2 overflow-y-auto">
                                    {details.events.map((ev, idx) => (
                                        <div key={`${ev.reason ?? 'ev'}-${idx}`} className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-3 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-slate-200">{ev.reason || 'Event'}</span>
                                                <span className="text-[10px] text-slate-500">{ev.type || 'Normal'}</span>
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-400">{ev.message || 'No message'}</p>
                                            <p className="mt-1 text-[10px] text-slate-600">
                                                {ev.sourceComponent ? `${ev.sourceComponent} · ` : ''}
                                                {ev.eventTime ? new Date(ev.eventTime).toLocaleString() : 'Timestamp unavailable'}
                                            </p>
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