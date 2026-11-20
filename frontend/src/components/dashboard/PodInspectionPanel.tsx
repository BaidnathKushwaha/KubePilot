import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
    X,
    RefreshCw,
    Server,
    Box,
    Activity,
    Database,
    Layers,
    Clock,
    Container,
    Tag,
} from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { PodInspection } from '../../types/podInspection'
import { StatusBadge } from './StatusBadge'
import { PodLogsViewer } from './PodLogsViewer'

interface PodInspectionPanelProps {
    namespace: string
    podName: string
    onClose: () => void
}

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 break-all text-xs text-slate-200">
                {value === null || value === undefined || value === '' ? 'Not available' : String(value)}
            </p>
        </div>
    )
}

function Section({
                     title,
                     icon,
                     children,
                 }: {
    title: string
    icon: ReactNode
    children: ReactNode
}) {
    return (
        <section className="mt-6">
            <div className="mb-3 flex items-center gap-2">
                <span className="text-cyan-300">{icon}</span>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{title}</h3>
            </div>
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                {children}
            </div>
        </section>
    )
}

export function PodInspectionPanel({ namespace, podName, onClose }: PodInspectionPanelProps) {
    const [pod, setPod] = useState<PodInspection | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadDetails = async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)

        try {
            const result = await clusterApi.getPodDetails(namespace, podName, signal)
            setPod(result)
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Failed to load pod details')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        void loadDetails(controller.signal)
        return () => controller.abort()
    }, [namespace, podName])

    const formatDate = (value: string | null) => {
        if (!value) return 'Not available'
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
    }

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
                aria-label="Pod inspection"
                className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/[0.08] bg-[#0b1220] p-5 shadow-2xl sm:p-7"
            >
                <header className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#0b1220]/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:-mt-7 sm:px-7">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            Kubernetes / Pod Inspection
                        </p>
                        <h2 className="mt-2 break-all text-lg font-semibold text-white">{podName}</h2>
                        <p className="mt-1 text-xs text-slate-500">{namespace}</p>
                        {pod && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                <StatusBadge status={pod.phase} />
                                <StatusBadge status={pod.ready ? 'Ready' : 'Not ready'} />
                            </div>
                        )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            disabled={loading}
                            title="Refresh inspection"
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close inspection"
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </header>

                {loading && !pod && (
                    <div className="py-16 text-center">
                        <RefreshCw size={20} className="mx-auto animate-spin text-cyan-300" />
                        <p className="mt-3 text-sm text-slate-400">Loading pod inspection...</p>
                    </div>
                )}

                {error && !pod && (
                    <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4">
                        <p className="text-sm text-red-300">Failed to load inspection data</p>
                        <p className="mt-2 break-all text-xs text-slate-400">{error}</p>
                        <button
                            type="button"
                            onClick={() => void loadDetails()}
                            className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {pod && (
                    <div className="pb-8">
                        <PodLogsViewer
                            namespace={pod.namespace}
                            podName={pod.name}
                            containers={pod.containers.map(container => container.name)}
                        />
                        {error && (
                            <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3 text-xs text-amber-300">
                                Refresh failed: {error}. Showing previously loaded data.
                            </p>
                        )}

                        {/* Overview */}
                        <Section title="Overview" icon={<Box size={15} />}>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem label="Namespace" value={pod.namespace} />
                                <InfoItem label="Phase" value={pod.phase} />
                                <InfoItem label="Ready" value={pod.ready ? 'Yes' : 'No'} />
                                <InfoItem label="Restarts" value={pod.restarts} />
                                <InfoItem label="Node" value={pod.nodeName} />
                                <InfoItem label="Pod IP" value={pod.podIP} />
                                <InfoItem label="Host IP" value={pod.hostIP} />
                                <InfoItem label="UID" value={pod.uid} />
                            </div>
                        </Section>

                        {/* Lifecycle */}
                        <Section title="Lifecycle" icon={<Clock size={15} />}>
                            <InfoItem label="Created" value={formatDate(pod.createdAt)} />
                            <InfoItem label="Start time" value={formatDate(pod.startTime)} />
                        </Section>

                        {/* Ownership */}
                        <Section title="Ownership" icon={<Layers size={15} />}>
                            <InfoItem label="Owner kind" value={pod.ownerKind} />
                            <InfoItem label="Owner name" value={pod.ownerName} />
                            <InfoItem label="Owner UID" value={pod.ownerUid} />
                        </Section>

                        {/* Conditions */}
                        <Section title="Conditions" icon={<Activity size={15} />}>
                            {pod.conditions.length === 0 ? (
                                <p className="text-xs text-slate-500">No conditions available.</p>
                            ) : (
                                <div className="space-y-3">
                                    {pod.conditions.map((condition) => (
                                        <div
                                            key={condition.type}
                                            className="rounded-lg border border-white/[0.05] p-3"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-medium text-slate-200">{condition.type}</p>
                                                <StatusBadge status={condition.status} />
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-3">
                                                <InfoItem label="Reason" value={condition.reason} />
                                                <InfoItem label="Transition" value={formatDate(condition.lastTransitionTime)} />
                                            </div>
                                            {condition.message && (
                                                <p className="mt-2 break-all text-xs text-slate-400">{condition.message}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Section>

                        {/* Containers */}
                        <Section title="Containers" icon={<Container size={15} />}>
                            {pod.containers.length === 0 ? (
                                <p className="text-xs text-slate-500">No containers found.</p>
                            ) : (
                                pod.containers.map((container) => (
                                    <div
                                        key={container.name}
                                        className="rounded-lg border border-white/[0.06] bg-slate-950/30 p-4"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h4 className="break-all text-sm font-semibold text-slate-200">{container.name}</h4>
                                                <p className="mt-1 break-all text-[11px] text-slate-500">{container.image}</p>
                                            </div>
                                            <StatusBadge status={container.state} />
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-4">
                                            <InfoItem label="Ready" value={container.ready ? 'Yes' : 'No'} />
                                            <InfoItem label="Restart count" value={container.restartCount} />
                                            <InfoItem label="Container ID" value={container.containerID} />
                                            <InfoItem label="State reason" value={container.stateReason} />
                                        </div>

                                        {container.stateMessage && (
                                            <p className="mt-3 break-all text-xs text-slate-400">{container.stateMessage}</p>
                                        )}

                                        <div className="mt-4 border-t border-white/[0.06] pt-3">
                                            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                Resource allocation
                                            </p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <InfoItem label="CPU request" value={container.cpuRequest} />
                                                <InfoItem label="CPU limit" value={container.cpuLimit} />
                                                <InfoItem label="Memory request" value={container.memoryRequest} />
                                                <InfoItem label="Memory limit" value={container.memoryLimit} />
                                            </div>
                                        </div>

                                        {container.lastTerminationReason && (
                                            <div className="mt-4 border-t border-white/[0.06] pt-3">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                    Last termination
                                                </p>
                                                <div className="mt-2 grid grid-cols-2 gap-3">
                                                    <InfoItem label="Reason" value={container.lastTerminationReason} />
                                                    <InfoItem label="Exit code" value={container.lastTerminationExitCode} />
                                                    <InfoItem label="Time" value={formatDate(container.lastTerminationTime)} />
                                                </div>
                                                {container.lastTerminationMessage && (
                                                    <p className="mt-2 break-all text-xs text-slate-400">
                                                        {container.lastTerminationMessage}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </Section>

                        {/* Volumes */}
                        <Section title="Volumes" icon={<Database size={15} />}>
                            {pod.volumes.length === 0 ? (
                                <p className="text-xs text-slate-500">No volumes found.</p>
                            ) : (
                                pod.volumes.map((volume) => (
                                    <div key={volume.name} className="rounded-lg border border-white/[0.05] p-3">
                                        <h4 className="break-all text-xs font-semibold text-slate-200">{volume.name}</h4>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <InfoItem label="Type" value={volume.type} />
                                            <InfoItem label="Source" value={volume.source} />
                                        </div>
                                        {volume.mountPaths.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500">Mount paths</p>
                                                <div className="mt-2 space-y-1">
                                                    {volume.mountPaths.map((path, index) => (
                                                        <p key={index} className="break-all font-mono text-[11px] text-slate-400">{path}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </Section>

                        {/* Labels */}
                        <Section title="Labels" icon={<Tag size={15} />}>
                            {Object.keys(pod.labels).length === 0 ? (
                                <p className="text-xs text-slate-500">No labels.</p>
                            ) : (
                                Object.entries(pod.labels).map(([key, value]) => (
                                    <InfoItem key={key} label={key} value={value} />
                                ))
                            )}
                        </Section>

                        {/* Annotations */}
                        <Section title="Annotations" icon={<Server size={15} />}>
                            {Object.keys(pod.annotations).length === 0 ? (
                                <p className="text-xs text-slate-500">No annotations.</p>
                            ) : (
                                Object.entries(pod.annotations).map(([key, value]) => (
                                    <InfoItem key={key} label={key} value={value} />
                                ))
                            )}
                        </Section>
                    </div>
                )}
            </aside>
        </div>
    )
}