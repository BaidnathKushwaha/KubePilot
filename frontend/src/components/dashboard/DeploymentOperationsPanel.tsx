import { useCallback, useEffect, useState } from 'react'
import {
    X,
    RefreshCw,
    Minus,
    Plus,
    RotateCcw,
    AlertTriangle,
    CheckCircle2,
    History,
    GitCommitHorizontal,
} from 'lucide-react'

import { clusterApi } from '../../services/api'
import type {
    DeploymentInfo,
    RolloutHistoryResponse,
    RolloutRevisionItem,
    RolloutStatusResponse,
    WorkloadOperationResponse,
} from '../../types/workload'
import type { DeploymentOperationResponse } from '../../services/api'
import type { HpaResponse } from '../../types/traffic'

interface Props {
    deployment: DeploymentInfo
    onClose: () => void
    onOperationComplete: () => void
}

const MIN_REPLICAS = 0
const MAX_REPLICAS = 50

export function DeploymentOperationsPanel({
                                              deployment,
                                              onClose,
                                              onOperationComplete,
                                          }: Props) {
    const [replicas, setReplicas] = useState(deployment.desiredReplicas)
    const [scaling, setScaling] = useState(false)
    const [restarting, setRestarting] = useState(false)
    const [rollingBack, setRollingBack] = useState(false)
    const [result, setResult] = useState<DeploymentOperationResponse | null>(null)
    const [rollbackResult, setRollbackResult] = useState<WorkloadOperationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [rolloutStatus, setRolloutStatus] = useState<RolloutStatusResponse | null>(null)
    const [rolloutHistory, setRolloutHistory] = useState<RolloutHistoryResponse | null>(null)
    const [rolloutLoading, setRolloutLoading] = useState(false)
    const [selectedRevision, setSelectedRevision] = useState<RolloutRevisionItem | null>(null)

    const [targetingHpas, setTargetingHpas] = useState<HpaResponse[]>([])
    const [hpaAckChecked, setHpaAckChecked] = useState(false)
    const [confirmRestartOpen, setConfirmRestartOpen] = useState(false)
    const [confirmRollbackOpen, setConfirmRollbackOpen] = useState(false)

    const busy = scaling || restarting || rollingBack

    const loadRolloutAndHpaData = useCallback(async () => {
        setRolloutLoading(true)
        try {
            const [statusRes, historyRes, hpaList] = await Promise.all([
                clusterApi.getDeploymentRolloutStatus(deployment.namespace, deployment.name),
                clusterApi.getDeploymentRolloutHistory(deployment.namespace, deployment.name),
                clusterApi.getHpas(deployment.namespace).catch(() => []),
            ])
            setRolloutStatus(statusRes)
            setRolloutHistory(historyRes)
            const defaultCandidate = historyRes.revisions.find((r) => r.rollbackCandidate) ?? null
            setSelectedRevision(defaultCandidate)
            setTargetingHpas(
                hpaList.filter(
                    (h) => h.targetKind === 'Deployment' && h.targetName === deployment.name,
                ),
            )
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Failed to load rollout details')
        } finally {
            setRolloutLoading(false)
        }
    }, [deployment.name, deployment.namespace])

    useEffect(() => {
        setReplicas(deployment.desiredReplicas)
        setResult(null)
        setRollbackResult(null)
        setError(null)
        setHpaAckChecked(false)
        setConfirmRestartOpen(false)
        setConfirmRollbackOpen(false)
        void loadRolloutAndHpaData()
    }, [deployment, loadRolloutAndHpaData])

    const handleScale = async () => {
        if (!Number.isInteger(replicas) || replicas < MIN_REPLICAS || replicas > MAX_REPLICAS) {
            setError(`Desired replicas must be an integer between ${MIN_REPLICAS} and ${MAX_REPLICAS}.`)
            return
        }
        if (targetingHpas.length > 0 && !hpaAckChecked) {
            setError('Acknowledge the HPA advisory before applying a manual replica change.')
            return
        }

        setScaling(true)
        setError(null)
        setResult(null)
        setRollbackResult(null)

        try {
            const response = await clusterApi.scaleDeployment(
                deployment.namespace,
                deployment.name,
                replicas,
            )

            setResult(response)
            setHpaAckChecked(false)
            onOperationComplete()
            void loadRolloutAndHpaData()
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
        setRestarting(true)
        setError(null)
        setResult(null)
        setRollbackResult(null)

        try {
            const response = await clusterApi.restartDeployment(
                deployment.namespace,
                deployment.name,
            )

            setResult(response)
            setConfirmRestartOpen(false)
            onOperationComplete()
            void loadRolloutAndHpaData()
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

    const handleRollback = async () => {
        if (!selectedRevision) {
            setError('Select a historical revision to roll back to.')
            return
        }

        setRollingBack(true)
        setError(null)
        setResult(null)
        setRollbackResult(null)

        try {
            const response = await clusterApi.rollbackDeployment(
                deployment.namespace,
                deployment.name,
                selectedRevision.revision,
            )
            setRollbackResult(response)
            setConfirmRollbackOpen(false)
            onOperationComplete()
            void loadRolloutAndHpaData()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Rollback operation failed')
        } finally {
            setRollingBack(false)
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

                {/* Rollout Status */}
                <section className="mt-5 rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <GitCommitHorizontal size={15} className="text-cyan-300" />
                            <h3 className="text-sm font-semibold text-slate-200">
                                Rollout Status
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => void loadRolloutAndHpaData()}
                            disabled={rolloutLoading || busy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={rolloutLoading ? 'animate-spin' : ''} />
                            Sync Rollout
                        </button>
                    </div>

                    {rolloutStatus ? (
                        <div className="mt-3 space-y-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                                <span className="rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                                    {rolloutStatus.phase}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    Rev: {rolloutStatus.currentRevision ?? '—'} · Gen: {rolloutStatus.observedGeneration}/{rolloutStatus.generation ?? '—'}
                                </span>
                            </div>
                            <p className="leading-5 text-slate-300">{rolloutStatus.summary}</p>
                            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/[0.05] bg-slate-950/30 p-3 text-[11px] text-slate-400">
                                <span>Desired: <strong className="text-slate-200">{rolloutStatus.desiredReplicas}</strong></span>
                                <span>Updated: <strong className="text-slate-200">{rolloutStatus.updatedReplicas}</strong></span>
                                <span>Ready: <strong className="text-slate-200">{rolloutStatus.readyReplicas}</strong></span>
                                <span>Available: <strong className="text-slate-200">{rolloutStatus.availableReplicas}</strong></span>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-3 text-xs text-slate-500">
                            {rolloutLoading ? 'Loading rollout status...' : 'Rollout status not available.'}
                        </p>
                    )}
                </section>

                {/* Rollout History & Rollback */}
                <section className="mt-5 rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                    <div className="flex items-center gap-2">
                        <History size={15} className="text-indigo-300" />
                        <h3 className="text-sm font-semibold text-slate-200">
                            Rollout History & Rollback
                        </h3>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        Inspect owned ReplicaSet revisions and select a prior revision to restore its pod template.
                    </p>

                    <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                        {!rolloutHistory || rolloutHistory.revisions.length === 0 ? (
                            <p className="text-xs text-slate-500">
                                {rolloutLoading ? 'Loading revisions...' : 'No revision history available.'}
                            </p>
                        ) : (
                            rolloutHistory.revisions.map((rev) => {
                                const isSelected = selectedRevision?.revision === rev.revision
                                return (
                                    <button
                                        key={rev.replicaSetName}
                                        type="button"
                                        disabled={rev.current || busy}
                                        onClick={() => {
                                            setSelectedRevision(rev)
                                            setConfirmRollbackOpen(false)
                                        }}
                                        className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                                            isSelected
                                                ? 'border-indigo-400/50 bg-indigo-500/10'
                                                : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                                        } disabled:cursor-default disabled:opacity-75`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-slate-200">
                                                Revision {rev.revision}
                                            </span>
                                            <span className="rounded px-2 py-0.5 text-[10px] font-medium bg-white/[0.06] text-slate-300">
                                                {rev.current ? 'Current' : 'Available'}
                                            </span>
                                        </div>
                                        <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                                            {rev.replicaSetName}
                                        </p>
                                        {rev.images.length > 0 && (
                                            <p className="mt-1 truncate text-[11px] text-slate-400">
                                                Images: {rev.images.join(', ')}
                                            </p>
                                        )}
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {selectedRevision && (
                        <div className="mt-3 rounded-lg border border-indigo-400/20 bg-indigo-400/[0.04] p-3 text-[11px] text-slate-300">
                            Selected target: <strong>Revision {selectedRevision.revision}</strong> ({selectedRevision.replicaSetName})
                            {selectedRevision.images.length > 0 && ` · ${selectedRevision.images.join(', ')}`}
                        </div>
                    )}

                    {confirmRollbackOpen && selectedRevision && (
                        <div className="mt-3 rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-3 text-xs text-indigo-100">
                            <p>
                                Confirm rollback of <strong>Deployment {deployment.namespace}/{deployment.name}</strong> to <strong>Revision {selectedRevision.revision}</strong>?
                            </p>
                            <div className="mt-2.5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleRollback()}
                                    disabled={busy}
                                    className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
                                >
                                    Confirm Rollback
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmRollbackOpen(false)}
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
                        onClick={() => setConfirmRollbackOpen(true)}
                        disabled={busy || !selectedRevision || !selectedRevision.rollbackCandidate}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-4 py-3 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <History size={15} className={rollingBack ? 'animate-spin' : ''} />
                        {rollingBack
                            ? 'Rolling back...'
                            : selectedRevision
                                ? `Roll Back to Revision ${selectedRevision.revision}`
                                : 'No Rollback Candidate'}
                    </button>
                </section>

                {/* Scaling */}
                <section className="mt-5 rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                    <div className="flex items-center gap-2">
                        <RefreshCw size={15} className="text-cyan-300" />

                        <h3 className="text-sm font-semibold text-slate-200">
                            Scale Deployment
                        </h3>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                        Target: <strong className="text-slate-300">Deployment {deployment.namespace}/{deployment.name}</strong> · Requested replicas: <strong className="text-cyan-200">{replicas}</strong>. The 0–50 range is an operational guardrail, not a guarantee of cluster capacity.
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
                                        I understand an HPA may override this manual scale operation for {deployment.namespace}/{deployment.name} ({replicas} replicas).
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-5">
                        <label className="text-xs text-slate-400">
                            Desired replicas
                        </label>

                        <div className="mt-2 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setReplicas((value) => Math.max(MIN_REPLICAS, value - 1))
                                }
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
                                    const value = event.target.value

                                    if (value === '') {
                                        setReplicas(MIN_REPLICAS)
                                        return
                                    }

                                    const parsed = Number(value)

                                    if (
                                        Number.isInteger(parsed) &&
                                        parsed >= MIN_REPLICAS &&
                                        parsed <= MAX_REPLICAS
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
                                    setReplicas((value) => Math.min(MAX_REPLICAS, value + 1))
                                }
                                disabled={busy || replicas >= MAX_REPLICAS}
                                className="rounded-lg border border-white/[0.08] p-3 text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        <p className="mt-2 text-[10px] text-slate-500">
                            Operational guardrail range: {MIN_REPLICAS} to {MAX_REPLICAS} replicas (does not guarantee available cluster capacity)
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
                            replicas < MIN_REPLICAS ||
                            replicas > MAX_REPLICAS ||
                            (targetingHpas.length > 0 && !hpaAckChecked)
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
                                {`Apply Scaling (${replicas} replicas)`}
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

                    {confirmRestartOpen && (
                        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
                            <p>
                                Confirm rolling restart of <strong>Deployment {deployment.namespace}/{deployment.name}</strong>?
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
                        {restarting ? 'Restarting...' : 'Restart Deployment'}
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
                                    {result.operation} operation: {result.status} ({result.namespace}/{result.name})
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

                {rollbackResult && (
                    <section className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2
                                size={18}
                                className="shrink-0 text-emerald-400"
                            />
                            <div>
                                <p className="text-sm font-semibold text-emerald-300">
                                    {rollbackResult.operation}: {rollbackResult.status}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-slate-300">
                                    {rollbackResult.message}
                                </p>
                                <p className="mt-2 text-[10px] text-slate-500">
                                    {new Date(rollbackResult.timestamp).toLocaleString()}
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