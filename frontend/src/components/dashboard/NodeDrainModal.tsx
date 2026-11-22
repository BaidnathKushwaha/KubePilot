import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { NodeDrainPrecheckResponse, NodeDrainResponse } from '../../types/cluster'
import { StatusBadge } from './StatusBadge'

interface NodeDrainModalProps {
    nodeName: string
    onClose: () => void
    onDrainComplete: () => void
}

export function NodeDrainModal({ nodeName, onClose, onDrainComplete }: NodeDrainModalProps) {
    const [precheck, setPrecheck] = useState<NodeDrainPrecheckResponse | null>(null)
    const [loadingPrecheck, setLoadingPrecheck] = useState(true)
    const [precheckError, setPrecheckError] = useState<string | null>(null)

    const [confirmedRisk, setConfirmedRisk] = useState(false)
    const [draining, setDraining] = useState(false)
    const [drainResult, setDrainResult] = useState<NodeDrainResponse | null>(null)
    const [drainError, setDrainError] = useState<string | null>(null)

    const loadPrecheck = async (signal?: AbortSignal) => {
        setLoadingPrecheck(true)
        setPrecheckError(null)
        try {
            const res = await clusterApi.precheckNodeDrain(nodeName, signal)
            setPrecheck(res)
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setPrecheckError(cause instanceof Error ? cause.message : 'Failed to run drain precheck')
        } finally {
            if (!signal?.aborted) setLoadingPrecheck(false)
        }
    }

    useEffect(() => {
        setConfirmedRisk(false)
        setDrainResult(null)
        setDrainError(null)
        const controller = new AbortController()
        void loadPrecheck(controller.signal)
        return () => controller.abort()
    }, [nodeName])

    const handleDrain = async () => {
        if (!confirmedRisk) return
        setDraining(true)
        setDrainError(null)
        setDrainResult(null)
        try {
            const res = await clusterApi.drainNode(nodeName)
            setDrainResult(res)
            onDrainComplete()
        } catch (cause) {
            setDrainError(cause instanceof Error ? cause.message : 'Node drain failed')
        } finally {
            setDraining(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !draining) onClose()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Drain node"
                className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/[0.09] bg-[#0b1220] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">
                            Kubernetes / Node Maintenance
                        </p>
                        <h2 className="mt-1.5 text-lg font-semibold text-white">Drain Node: {nodeName}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Cordons the node and evicts controller-managed pods safely without bypassing PDBs or force-deleting pods.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={draining}
                        className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/5 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                {loadingPrecheck && (
                    <div className="py-12 text-center text-xs text-slate-400">
                        <RefreshCw size={18} className="mx-auto animate-spin text-cyan-300" />
                        <p className="mt-2">Running drain precheck across pods, PDBs, and volumes...</p>
                    </div>
                )}

                {precheckError && (
                    <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-4 text-xs text-red-300">
                        {precheckError}
                    </div>
                )}

                {precheck && !drainResult && (
                    <div className="mt-5 space-y-5">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="text-[10px] text-slate-500">Scheduled</p>
                                <p className="mt-1 text-lg font-semibold text-white">{precheck.totalScheduledPods}</p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="text-[10px] text-slate-500">Evictable</p>
                                <p className="mt-1 text-lg font-semibold text-emerald-300">{precheck.evictablePodCount}</p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="text-[10px] text-slate-500">DaemonSets</p>
                                <p className="mt-1 text-lg font-semibold text-slate-200">{precheck.daemonSetPodCount}</p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="text-[10px] text-slate-500">Unmanaged</p>
                                <p className="mt-1 text-lg font-semibold text-amber-300">{precheck.unmanagedPodCount}</p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="text-[10px] text-slate-500">Local Storage</p>
                                <p className="mt-1 text-lg font-semibold text-cyan-300">{precheck.localStoragePodCount}</p>
                            </div>
                        </div>

                        {precheck.blockers.length > 0 && (
                            <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.05] p-4 text-xs text-rose-200">
                                <p className="font-semibold">Precheck Blockers ({precheck.blockers.length})</p>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-200/90">
                                    {precheck.blockers.map((b, i) => <li key={i}>{b}</li>)}
                                </ul>
                            </div>
                        )}

                        {precheck.warnings.length > 0 && (
                            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-4 text-xs text-amber-200">
                                <p className="font-semibold">Precheck Notices ({precheck.warnings.length})</p>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-200/90">
                                    {precheck.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="max-h-52 overflow-y-auto rounded-xl border border-white/[0.06] bg-slate-950/40 p-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Pod Eviction Assessment
                            </p>
                            <div className="space-y-2 text-xs">
                                {precheck.pods.map((p) => (
                                    <div key={`${p.namespace}/${p.name}`} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.05] p-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-slate-200">{p.namespace}/{p.name}</p>
                                            <p className="mt-0.5 text-[11px] text-slate-400">{p.note}</p>
                                        </div>
                                        <StatusBadge status={p.evictable ? 'Evictable' : p.daemonSet ? 'DaemonSet' : 'Blocked'} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={confirmedRisk}
                                onChange={(e) => setConfirmedRisk(e.target.checked)}
                                disabled={draining}
                                className="mt-0.5 accent-amber-400"
                            />
                            <span>
                I understand this will cordon <strong>{nodeName}</strong> and evict controller-managed pods using the Kubernetes Eviction API (without force-deletion or bypassing PDBs).
              </span>
                        </label>
                    </div>
                )}

                {drainResult && (
                    <div className="mt-5 space-y-4 text-xs">
                        <div className={`rounded-xl border p-4 ${
                            drainResult.status === 'COMPLETED'
                                ? 'border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-200'
                                : 'border-amber-400/25 bg-amber-400/[0.05] text-amber-200'
                        }`}>
                            <div className="flex items-start gap-2.5">
                                {drainResult.status === 'COMPLETED'
                                    ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" />
                                    : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />}
                                <div>
                                    <p className="font-semibold">
                                        Drain Status: {drainResult.status} · Maintenance Ready: {drainResult.readyForMaintenance ? 'Yes' : 'Not yet (blockers/remaining pods)'}
                                    </p>
                                    <p className="mt-1 text-slate-200">{drainResult.summary}</p>
                                    <p className="mt-1 text-[10px] text-slate-400">Audit ID: {drainResult.auditId}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="font-semibold text-slate-200">Evicted Pods ({drainResult.evictedPods.length})</p>
                                <p className="mt-1 font-mono text-[11px] text-slate-400">
                                    {drainResult.evictedPods.length > 0 ? drainResult.evictedPods.join(', ') : 'None'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                <p className="font-semibold text-slate-200">Skipped DaemonSets ({drainResult.skippedDaemonSetPods.length})</p>
                                <p className="mt-1 font-mono text-[11px] text-slate-400">
                                    {drainResult.skippedDaemonSetPods.length > 0 ? drainResult.skippedDaemonSetPods.join(', ') : 'None'}
                                </p>
                            </div>
                        </div>

                        {drainResult.failedOrBlockedPods.length > 0 && (
                            <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.05] p-3 text-rose-200">
                                <p className="font-semibold">Blocked or Failed Evictions ({drainResult.failedOrBlockedPods.length})</p>
                                <ul className="mt-1.5 space-y-1 text-[11px]">
                                    {drainResult.failedOrBlockedPods.map((f, i) => (
                                        <li key={i}>{f.namespace}/{f.name} [{f.reason}]: {f.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            <p className="font-semibold text-slate-200">Remaining Pods on Node ({drainResult.remainingPods.length})</p>
                            <p className="mt-1 font-mono text-[11px] text-slate-400">
                                {drainResult.remainingPods.length > 0 ? drainResult.remainingPods.join(', ') : 'None'}
                            </p>
                        </div>
                    </div>
                )}

                {drainError && (
                    <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-3.5 text-xs text-red-300">
                        {drainError}
                    </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-white/[0.07] pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={draining}
                        className="rounded-lg border border-white/[0.1] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                    >
                        {drainResult ? 'Close' : 'Cancel'}
                    </button>

                    {!drainResult && (
                        <button
                            type="button"
                            onClick={() => void handleDrain()}
                            disabled={draining || loadingPrecheck || !confirmedRisk}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ShieldAlert size={14} />
                            {draining ? 'Draining node...' : 'Execute Drain'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}