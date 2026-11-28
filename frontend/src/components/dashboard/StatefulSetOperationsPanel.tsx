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
import type { HpaResponse } from '../../types/traffic'

interface StatefulSetOperationsPanelProps {
    statefulSet: StatefulSetInfo
    onClose: () => void
    onOperationComplete: () => void
}

const MIN_REPLICAS = 0
const MAX_REPLICAS = 50

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
    const [targetingHpas, setTargetingHpas] = useState<HpaResponse[]>([])
    const [hpaAckChecked, setHpaAckChecked] = useState(false)
    const [confirmRestartOpen, setConfirmRestartOpen] = useState(false)

    const busy = scaling || restarting

    useEffect(() => {
        setReplicas(statefulSet.desiredReplicas)
        setResult(null)
        setError(null)
        setHpaAckChecked(false)
        setConfirmRestartOpen(false)

        const controller = new AbortController()
        clusterApi
            .getHpas(statefulSet.namespace, controller.signal)
            .then((list) => {
                setTargetingHpas(
                    list.filter(
                        (h) => h.targetKind === 'StatefulSet' && h.targetName === statefulSet.name,
                    ),
                )
            })
            .catch(() => {
                setTargetingHpas([])
            })
        return () => controller.abort()
    }, [statefulSet])

    const handleScale = async () => {
        if (!Number.isInteger(replicas) || replicas < MIN_REPLICAS || replicas > MAX_REPLICAS) {
            setError(`Replicas must be an integer between ${MIN_REPLICAS} and ${MAX_REPLICAS}.`)
            return
        }
        if (targetingHpas.length > 0 && !hpaAckChecked) {
            setError('Acknowledge the HPA advisory before applying a manual replica change.')
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
            setHpaAckChecked(false)
            onOperationComplete()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'StatefulSet scaling failed')
        } finally {
            setScaling(false)
        }
    }

    const handleRestart = async () => {
        setRestarting(true)
        setError(null)
        setResult(null)

        try {
            const response = await clusterApi.restartStatefulSet(
                statefulSet.namespace,
                statefulSet.name,
            )
            setResult(response)
            setConfirmRestartOpen(false)
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
                        Target: <strong className="text-slate-300">StatefulSet {statefulSet.namespace}/{statefulSet.name}</strong> · Requested replicas: <strong className="text-cyan-200">{replicas}</strong>. The 0–50 range is an operational guardrail, not a guarantee of cluster capacity.
                    </p>

                    {targetingHpas.length > 0 && (
                        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
                                <div>
                                    <p className="font-semibold">HPA Advisory: Autoscaler Targets This Workload</p>
                                    <p className="mt-1 leading-5 text-amber-100/90">
                                        Targeted by{' '}
                                        {targetingHpas
                                            .map((h) => `${h.name} (${h.minReplicas}..${h.maxReplicas} replicas)`)
                                            .join(', ')}
                                        . The HorizontalPodAutoscaler controller may override your manually requested replica count.
                                    </p>
                                    <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[11px] font-medium text-amber-100">
                                        <input
                                            type="checkbox"
                                            checked={hpaAckChecked}
                                            onChange={(e) => setHpaAckChecked(e.target.checked)}
                                            disabled={busy}
                                            className="accent-amber-400"
                                        />
                                        I understand an HPA may override this manual scale operation for {statefulSet.namespace}/{statefulSet.name} ({replicas} replicas).
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setReplicas((v) => Math.max(MIN_REPLICAS, v - 1))}
                            disabled={busy || replicas <= MIN_REPLICAS}
                            className="rounded-lg border border-white/[0.08] p-3 text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
                        >
                            <Minus size={16} />
                        </button>

                        <input
                            type="number"
                            min={MIN_REPLICAS}
                            max={MAX_REPLICAS}
                            value={replicas}
                            onChange={(event) => {
                                const raw = event.target.value
                                if (raw === '') {
                                    setReplicas(MIN_REPLICAS)
                                    return
                                }
                                const parsed = Number(raw)
                                if (Number.isInteger(parsed) && parsed >= MIN_REPLICAS && parsed <= MAX_REPLICAS) {
                                    setReplicas(parsed)
                                }
                            }}
                            disabled={busy}
                            className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-4 py-3 text-center text-lg font-semibold text-white outline-none focus:border-cyan-400/40"
                        />

                        <button
                            type="button"
                            onClick={() => setReplicas((v) => Math.min(MAX_REPLICAS, v + 1))}
                            disabled={busy || replicas >= MAX_REPLICAS}
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
                        disabled={
                            busy ||
                            replicas === statefulSet.desiredReplicas ||
                            replicas < MIN_REPLICAS ||
                            replicas > MAX_REPLICAS ||
                            (targetingHpas.length > 0 && !hpaAckChecked)
                        }
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <RefreshCw size={15} className={scaling ? 'animate-spin' : ''} />
                        {scaling ? 'Applying scale...' : `Apply Scaling (${replicas} replicas)`}
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

                    {confirmRestartOpen && (
                        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
                            <p>
                                Confirm rolling restart of <strong>StatefulSet {statefulSet.namespace}/{statefulSet.name}</strong>?
                            </p>
                            <div className="mt-2.5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleRestart()}
                                    disabled={busy}
                                    className="rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/25 disabled:opacity-50"
                                >
                                    Confirm Restart
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmRestartOpen(false)}
                                    disabled={busy}
                                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setConfirmRestartOpen(true)}
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
                                    {result.operation}: {result.status} ({result.namespace}/{result.name})
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