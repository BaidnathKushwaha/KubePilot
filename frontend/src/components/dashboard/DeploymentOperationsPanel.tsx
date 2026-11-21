import { useEffect, useState } from 'react'
import {
    X,
    RefreshCw,
    Minus,
    Plus,
    RotateCcw,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react'

import { clusterApi } from '../../services/api'
import type { DeploymentInfo } from '../../types/workload'
import type { DeploymentOperationResponse } from '../../services/api'

interface Props {
    deployment: DeploymentInfo
    onClose: () => void
    onOperationComplete: () => void
}

export function DeploymentOperationsPanel({
                                              deployment,
                                              onClose,
                                              onOperationComplete,
                                          }: Props) {
    const [replicas, setReplicas] = useState(deployment.desiredReplicas)
    const [scaling, setScaling] = useState(false)
    const [restarting, setRestarting] = useState(false)
    const [result, setResult] =
        useState<DeploymentOperationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const busy = scaling || restarting

    useEffect(() => {
        setReplicas(deployment.desiredReplicas)
        setResult(null)
        setError(null)
    }, [deployment])

    const handleScale = async () => {
        setScaling(true)
        setError(null)
        setResult(null)

        try {
            const response = await clusterApi.scaleDeployment(
                deployment.namespace,
                deployment.name,
                replicas,
            )

            setResult(response)
            onOperationComplete()
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Scaling operation failed',
            )
        } finally {
            setScaling(false)
        }
    }

    const handleRestart = async () => {
        const confirmed = window.confirm(
            `Restart Deployment "${deployment.name}" in namespace "${deployment.namespace}"?`,
        )

        if (!confirmed) return

        setRestarting(true)
        setError(null)
        setResult(null)

        try {
            const response = await clusterApi.restartDeployment(
                deployment.namespace,
                deployment.name,
            )

            setResult(response)
            onOperationComplete()
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Restart operation failed',
            )
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
                aria-label="Deployment operations"
                className="h-full w-full max-w-xl overflow-y-auto border-l border-white/[0.08] bg-[#0b1220] p-5 shadow-2xl sm:p-7"
            >
                {/* Header */}

                <header className="flex items-start justify-between border-b border-white/[0.07] pb-5">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                            Kubernetes / Operations
                        </p>

                        <h2 className="mt-2 break-all text-lg font-semibold text-white">
                            {deployment.name}
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            {deployment.namespace}
                        </p>
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

                {/* Current status */}

                <section className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="text-xs text-slate-500">
                        Current replica status
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                        <div>
                            <p className="text-2xl font-semibold text-white">
                                {deployment.readyReplicas}
                                <span className="text-slate-500">
                  {' / '}
                                    {deployment.desiredReplicas}
                </span>
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Ready / Desired
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                            className="h-full rounded-full bg-cyan-400 transition-all"
                            style={{
                                width: `${
                                    deployment.desiredReplicas > 0
                                        ? Math.min(
                                            100,
                                            (deployment.readyReplicas /
                                                deployment.desiredReplicas) *
                                            100,
                                        )
                                        : 0
                                }%`,
                            }}
                        />
                    </div>
                </section>

                {/* Scaling */}

                <section className="mt-6 rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                    <div className="flex items-center gap-2">
                        <RefreshCw size={15} className="text-cyan-300" />

                        <h3 className="text-sm font-semibold text-slate-200">
                            Scale Deployment
                        </h3>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        Change the desired replica count. Kubernetes will
                        automatically reconcile the Deployment.
                    </p>

                    <div className="mt-5">
                        <label className="text-xs text-slate-400">
                            Desired replicas
                        </label>

                        <div className="mt-2 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setReplicas((value) => Math.max(0, value - 1))
                                }
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
                                    const value = event.target.value

                                    if (value === '') {
                                        setReplicas(0)
                                        return
                                    }

                                    const parsed = Number(value)

                                    if (
                                        Number.isInteger(parsed) &&
                                        parsed >= 0 &&
                                        parsed <= 50
                                    ) {
                                        setReplicas(parsed)
                                    }
                                }}
                                disabled={busy}
                                className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-4 py-3 text-center text-lg font-semibold text-white outline-none focus:border-cyan-400/40 disabled:opacity-50"
                            />

                            <button
                                type="button"
                                onClick={() =>
                                    setReplicas((value) => Math.min(50, value + 1))
                                }
                                disabled={busy || replicas >= 50}
                                className="rounded-lg border border-white/[0.08] p-3 text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        <p className="mt-2 text-[10px] text-slate-500">
                            Allowed range: 0 to 50 replicas
                        </p>
                    </div>

                    {replicas === 0 && (
                        <div className="mt-4 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
                            <AlertTriangle
                                size={15}
                                className="shrink-0 text-amber-400"
                            />

                            <p className="text-xs leading-5 text-amber-300">
                                Scaling to zero will stop all Deployment pods.
                            </p>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => void handleScale()}
                        disabled={
                            busy ||
                            replicas === deployment.desiredReplicas ||
                            replicas < 0 ||
                            replicas > 50
                        }
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {scaling ? (
                            <>
                                <RefreshCw size={15} className="animate-spin" />
                                Applying scale...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={15} />
                                Apply Scaling
                            </>
                        )}
                    </button>
                </section>

                {/* Restart */}

                <section className="mt-5 rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                    <div className="flex items-center gap-2">
                        <RotateCcw size={15} className="text-amber-300" />

                        <h3 className="text-sm font-semibold text-slate-200">
                            Restart Deployment
                        </h3>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        Initiate a rolling restart. Kubernetes replaces the
                        existing pods while respecting the Deployment strategy.
                    </p>

                    <button
                        type="button"
                        onClick={() => void handleRestart()}
                        disabled={busy}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-400/[0.1] disabled:opacity-50"
                    >
                        {restarting ? (
                            <>
                                <RefreshCw size={15} className="animate-spin" />
                                Restarting...
                            </>
                        ) : (
                            <>
                                <RotateCcw size={15} />
                                Restart Deployment
                            </>
                        )}
                    </button>
                </section>

                {/* Operation result */}

                {result && (
                    <section className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2
                                size={18}
                                className="shrink-0 text-emerald-400"
                            />

                            <div>
                                <p className="text-sm font-semibold text-emerald-300">
                                    {result.operation} operation: {result.status}
                                </p>

                                <p className="mt-2 text-xs leading-5 text-slate-300">
                                    {result.message}
                                </p>

                                {result.desiredReplicas !== null && (
                                    <p className="mt-2 text-xs text-slate-400">
                                        Requested replicas: {result.desiredReplicas}
                                    </p>
                                )}

                                <p className="mt-2 text-[10px] text-slate-500">
                                    {new Date(result.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Error */}

                {error && (
                    <section className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.04] p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle
                                size={18}
                                className="shrink-0 text-red-400"
                            />

                            <div>
                                <p className="text-sm font-semibold text-red-300">
                                    Operation failed
                                </p>

                                <p className="mt-2 break-all text-xs leading-5 text-red-300/80">
                                    {error}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Footer */}

                <div className="mt-6 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                    <p className="text-[10px] leading-5 text-slate-500">
                        Operations are sent directly to the Kubernetes API
                        through KubePilot. Kubernetes reconciliation is
                        asynchronous. An ACCEPTED response does not mean
                        the requested state is already achieved.
                    </p>
                </div>
            </aside>
        </div>
    )
}