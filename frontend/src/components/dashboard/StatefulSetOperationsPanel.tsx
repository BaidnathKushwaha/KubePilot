import { useEffect, useState } from 'react'
import {
    AlertTriangle,
    CheckCircle2,
    Minus,
    Plus,
    RefreshCw,
    RotateCcw,
    X,
} from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { StatefulSetInfo, WorkloadOperationResponse } from '../../types/workload'

interface StatefulSetOperationsPanelProps {
    statefulSet: StatefulSetInfo
    onClose: () => void
    onOperationComplete: () => void
}

export function StatefulSetOperationsPanel({
                                               statefulSet,
                                               onClose,
                                               onOperationComplete,
                                           }: StatefulSetOperationsPanelProps) {
    const [replicas, setReplicas] = useState(statefulSet.desiredReplicas)
    const [scaling, setScaling] = useState(false)
    const [restarting, setRestarting] = useState(false)
    const [result, setResult] = useState<WorkloadOperationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const busy = scaling || restarting

    useEffect(() => {
        setReplicas(statefulSet.desiredReplicas)
        setResult(null)
        setError(null)
    }, [statefulSet])

    const handleScale = async () => {
        if (replicas < 0 || replicas > 50) {
            setError('Replicas must be between 0 and 50.')
            return
        }

        setScaling(true)
        setError(null)
        setResult(null)

        try {
            const response = await clusterApi.scaleStatefulSet(
                statefulSet.namespace,
                statefulSet.name,
                replicas,
            )
            setResult(response)
            onOperationComplete()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'StatefulSet scaling failed')
        } finally {
            setScaling(false)
        }
    }

    const handleRestart = async () => {
        const confirmed = window.confirm(
            `Restart StatefulSet "${statefulSet.name}" in namespace "${statefulSet.namespace}"? Pods will be reconciled according to the StatefulSet update strategy.`,
        )
        if (!confirmed) return

        setRestarting(true)
        setError(null)
        setResult(null)

        try {
            const response = await clusterApi.restartStatefulSet(
                statefulSet.namespace,
                statefulSet.name,
            )
            setResult(response)
            onOperationComplete()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'StatefulSet restart failed')
        } finally {
            setRestarting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[90] flex justify-end bg-slate-950/70 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy) {
                    onClose()
                }
            }}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="StatefulSet operations"
                className="h-full w-full max-w-xl overflow-y-auto border-l border-white/[0.08] bg-[#0b1220] p-5 shadow-2xl sm:p-7"
            >
                <header className="flex items-start justify-between border-b border-white/[0.07] pb-5">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                            Kubernetes / StatefulSet Operations
                        </p>
                        <h2 className="mt-2 break-all text-lg font-semibold text-white">
                            {statefulSet.name}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">{statefulSet.namespace}</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/5 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </header>

                <section className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="text-xs text-slate-500">Current replica status</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                        {statefulSet.readyReplicas}
                        <span className="text-slate-500"> / {statefulSet.desiredReplicas}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Ready / Desired · Current: {statefulSet.currentReplicas}
                    </p>
                </section>

                <section className="mt-6 rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                    <div className="flex items-center gap-2">
                        <RefreshCw size={15} className="text-cyan-300" />
                        <h3 className="text-sm font-semibold text-slate-200">Scale StatefulSet</h3>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        Adjust desired replicas. StatefulSet controllers scale pods in ordered index sequence.
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setReplicas((v) => Math.max(0, v - 1))}
                            disabled={busy || replicas <= 0}
                            className="rounded-lg border border-white/[0.08] p-3 text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
                        >
                            <Minus size={16} />
                        </button>

                        <input
                            type="number"
                            min={0}
                            max={50}
                            value={replicas}
                            onChange={(event) => {
                                const raw = event.target.value
                                if (raw === '') {
                                    setReplicas(0)
                                    return
                                }
                                const parsed = Number(raw)
                                if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 50) {
                                    setReplicas(parsed)
                                }
                            }}
                            disabled={busy}
                            className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-4 py-3 text-center text-lg font-semibold text-white outline-none focus:border-cyan-400/40"
                        />

                        <button
                            type="button"
                            onClick={() => setReplicas((v) => Math.min(50, v + 1))}
                            disabled={busy || replicas >= 50}
                            className="rounded-lg border border-white/[0.08] p-3 text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {replicas === 0 && (
                        <div className="mt-4 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
                            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                            <p className="text-xs text-amber-300">
                                Scaling to 0 will terminate StatefulSet pods while preserving PersistentVolumeClaims.
                            </p>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => void handleScale()}
                        disabled={busy || replicas === statefulSet.desiredReplicas}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <RefreshCw size={15} className={scaling ? 'animate-spin' : ''} />
                        {scaling ? 'Applying scale...' : 'Apply Scaling'}
                    </button>
                </section>

                <section className="mt-5 rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                    <div className="flex items-center gap-2">
                        <RotateCcw size={15} className="text-amber-300" />
                        <h3 className="text-sm font-semibold text-slate-200">Restart StatefulSet</h3>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        Updates pod template annotation to trigger pod recreation according to the StatefulSet update strategy.
                    </p>

                    <button
                        type="button"
                        onClick={() => void handleRestart()}
                        disabled={busy}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-400/[0.1] disabled:opacity-50"
                    >
                        <RotateCcw size={15} className={restarting ? 'animate-spin' : ''} />
                        {restarting ? 'Restarting...' : 'Restart StatefulSet'}
                    </button>
                </section>

                {result && (
                    <section className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
                            <div>
                                <p className="text-sm font-semibold text-emerald-300">
                                    {result.operation}: {result.status}
                                </p>
                                <p className="mt-1.5 text-xs leading-5 text-slate-300">{result.message}</p>
                                <p className="mt-2 text-[10px] text-slate-500">
                                    {new Date(result.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {error && (
                    <section className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.04] p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={18} className="shrink-0 text-red-400" />
                            <div>
                                <p className="text-sm font-semibold text-red-300">Operation failed</p>
                                <p className="mt-1.5 break-all text-xs text-red-300/80">{error}</p>
                            </div>
                        </div>
                    </section>
                )}

                <div className="mt-6 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                    <p className="text-[10px] leading-5 text-slate-500">
                        ACCEPTED indicates the Kubernetes API accepted the mutation request. Actual pod readiness and reconciliation happen asynchronously.
                    </p>
                </div>
            </aside>
        </div>
    )
}