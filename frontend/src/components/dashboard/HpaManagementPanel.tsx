import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Gauge, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { HpaResponse, HpaUpsertRequest } from '../../types/traffic'
import type { WorkloadOperationResponse } from '../../types/workload'
import { StatusBadge } from './StatusBadge'

interface HpaManagementPanelProps {
    namespace?: string
    defaultTargetKind?: 'Deployment' | 'StatefulSet'
    defaultTargetName?: string
    onClose: () => void
    onChanged?: () => void
}

export function HpaManagementPanel({
                                       namespace,
                                       defaultTargetKind = 'Deployment',
                                       defaultTargetName = '',
                                       onClose,
                                       onChanged,
                                   }: HpaManagementPanelProps) {
    const [hpas, setHpas] = useState<HpaResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [opResult, setOpResult] = useState<WorkloadOperationResponse | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const [editingName, setEditingName] = useState<string | null>(null)
    const [hpaName, setHpaName] = useState(defaultTargetName ? `${defaultTargetName}-hpa` : '')
    const [targetNs, setTargetNs] = useState(namespace || 'robot-shop')
    const [targetKind, setTargetKind] = useState<'Deployment' | 'StatefulSet'>(defaultTargetKind)
    const [targetName, setTargetName] = useState(defaultTargetName)
    const [minReplicas, setMinReplicas] = useState(1)
    const [maxReplicas, setMaxReplicas] = useState(4)
    const [metricName, setMetricName] = useState<'cpu' | 'memory'>('cpu')
    const [targetUtil, setTargetUtil] = useState(75)

    const loadHpas = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)
        try {
            setHpas(await clusterApi.getHpas(namespace || undefined, signal))
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            setError(cause instanceof Error ? cause.message : 'Unable to load HPAs')
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [namespace])

    useEffect(() => {
        const controller = new AbortController()
        void loadHpas(controller.signal)
        return () => controller.abort()
    }, [loadHpas])

    const startEdit = (item: HpaResponse) => {
        setEditingName(item.name)
        setHpaName(item.name)
        setTargetNs(item.namespace)
        setTargetKind(item.targetKind === 'StatefulSet' ? 'StatefulSet' : 'Deployment')
        setTargetName(item.targetName)
        setMinReplicas(item.minReplicas)
        setMaxReplicas(item.maxReplicas)
        setMetricName(item.metricName === 'memory' ? 'memory' : 'cpu')
        setTargetUtil(item.targetUtilizationPercent ?? 75)
        setError(null)
        setOpResult(null)
    }

    const resetForm = () => {
        setEditingName(null)
        setHpaName(defaultTargetName ? `${defaultTargetName}-hpa` : '')
        setTargetName(defaultTargetName)
        setMinReplicas(1)
        setMaxReplicas(4)
        setMetricName('cpu')
        setTargetUtil(75)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!hpaName.trim() || !targetNs.trim() || !targetName.trim()) {
            setError('HPA name, namespace, and target workload name are required.')
            return
        }
        if (
            !Number.isInteger(minReplicas) ||
            !Number.isInteger(maxReplicas) ||
            minReplicas < 1 ||
            maxReplicas > 50 ||
            minReplicas > maxReplicas
        ) {
            setError('Replicas must satisfy 1 <= minReplicas <= maxReplicas <= 50.')
            return
        }
        if (!Number.isInteger(targetUtil) || targetUtil < 1 || targetUtil > 100) {
            setError('Target utilization must be between 1% and 100%.')
            return
        }

        const payload: HpaUpsertRequest = {
            name: hpaName.trim(),
            namespace: targetNs.trim(),
            targetKind,
            targetName: targetName.trim(),
            minReplicas,
            maxReplicas,
            metricName,
            targetUtilizationPercent: targetUtil,
        }

        setSubmitting(true)
        setError(null)
        setOpResult(null)
        try {
            const res = editingName
                ? await clusterApi.updateHpa(targetNs.trim(), editingName, payload)
                : await clusterApi.createHpa(payload)
            setOpResult(res)
            resetForm()
            await loadHpas()
            onChanged?.()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Failed to save HPA')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (item: HpaResponse) => {
        const confirmed = window.confirm(`Delete HPA "${item.name}" in namespace "${item.namespace}"?`)
        if (!confirmed) return

        setSubmitting(true)
        setError(null)
        setOpResult(null)
        try {
            const res = await clusterApi.deleteHpa(item.namespace, item.name)
            setOpResult(res)
            await loadHpas()
            onChanged?.()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Failed to delete HPA')
        } finally {
            setSubmitting(false)
        }
    }

    const hasRequestWarning = Boolean(opResult?.message?.includes('Warning:'))

    return (
        <div
            className="fixed inset-0 z-[90] flex justify-end bg-slate-950/70 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !submitting) onClose()
            }}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="HorizontalPodAutoscaler management"
                className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/[0.08] bg-[#0b1220] p-5 shadow-2xl sm:p-7"
            >
                <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            Kubernetes / Autoscaling (v2)
                        </p>
                        <h2 className="mt-2 text-lg font-semibold text-white">HorizontalPodAutoscalers</h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Discover, configure, update, and delete HPAs {namespace ? `in ${namespace}` : 'across namespaces'}.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void loadHpas()}
                            disabled={loading || submitting}
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/5 disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/5 disabled:opacity-50"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </header>

                {/* Create / Update Form */}
                <form onSubmit={(e) => void handleSave(e)} className="mt-5 space-y-3 rounded-xl border border-white/[0.07] bg-[#0d1523] p-4 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold text-slate-200">
                            <Gauge size={14} className="text-cyan-300" />
                            {editingName ? `Update HPA: ${editingName}` : 'Create HorizontalPodAutoscaler'}
                        </span>
                        {editingName && (
                            <button type="button" onClick={resetForm} className="text-[11px] text-slate-400 underline">
                                Cancel Edit
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="block text-slate-400">HPA Name</label>
                            <input
                                value={hpaName}
                                onChange={(e) => setHpaName(e.target.value)}
                                disabled={Boolean(editingName) || submitting}
                                placeholder="catalogue-hpa"
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100 disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400">Namespace</label>
                            <input
                                value={targetNs}
                                onChange={(e) => setTargetNs(e.target.value)}
                                disabled={Boolean(editingName) || submitting}
                                placeholder="robot-shop"
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100 disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400">Target Kind</label>
                            <select
                                value={targetKind}
                                onChange={(e) => setTargetKind(e.target.value === 'StatefulSet' ? 'StatefulSet' : 'Deployment')}
                                disabled={submitting}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100"
                            >
                                <option value="Deployment">Deployment</option>
                                <option value="StatefulSet">StatefulSet</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-400">Target Workload Name</label>
                            <input
                                value={targetName}
                                onChange={(e) => setTargetName(e.target.value)}
                                disabled={submitting}
                                placeholder="catalogue"
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400">Min Replicas (1–50)</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={minReplicas}
                                onChange={(e) => {
                                    const parsed = Number(e.target.value)
                                    setMinReplicas(Number.isFinite(parsed) ? Math.trunc(parsed) : 0)
                                }}
                                disabled={submitting}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400">Max Replicas (1–50)</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={maxReplicas}
                                onChange={(e) => {
                                    const parsed = Number(e.target.value)
                                    setMaxReplicas(Number.isFinite(parsed) ? Math.trunc(parsed) : 0)
                                }}
                                disabled={submitting}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400">Metric</label>
                            <select
                                value={metricName}
                                onChange={(e) => setMetricName(e.target.value === 'memory' ? 'memory' : 'cpu')}
                                disabled={submitting}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100"
                            >
                                <option value="cpu">cpu</option>
                                <option value="memory">memory</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-400">Target Utilization % (1–100)</label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={targetUtil}
                                onChange={(e) => {
                                    const parsed = Number(e.target.value)
                                    setTargetUtil(Number.isFinite(parsed) ? Math.trunc(parsed) : 0)
                                }}
                                disabled={submitting}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-100"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/15 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
                    >
                        <Plus size={14} />
                        {submitting ? 'Submitting...' : editingName ? 'Update HPA' : 'Create HPA'}
                    </button>
                </form>

                {opResult && (
                    <div
                        className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                            hasRequestWarning
                                ? 'border-amber-400/30 bg-amber-400/[0.06] text-amber-100'
                                : 'border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-200'
                        }`}
                    >
                        {hasRequestWarning ? (
                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                        ) : (
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                        )}
                        <div>
                            <p className="font-semibold">{opResult.operation}: {opResult.status}</p>
                            <p className="mt-1 text-slate-200">{opResult.message}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-3 text-xs text-red-300">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
                        <p className="break-all">{error}</p>
                    </div>
                )}

                {/* Discovered HPAs */}
                <section className="mt-6 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Discovered HPAs ({hpas.length})
                    </h3>
                    {hpas.length === 0 ? (
                        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-500">
                            {loading ? 'Loading HPAs...' : 'No HorizontalPodAutoscalers found in scope.'}
                        </p>
                    ) : (
                        hpas.map((h) => (
                            <div key={`${h.namespace}/${h.name}`} className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-4 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-white">{h.name}</p>
                                        <p className="text-[11px] text-slate-400">
                                            {h.namespace} · Target: {h.targetKind}/{h.targetName}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startEdit(h)}
                                            disabled={submitting}
                                            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/5"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(h)}
                                            disabled={submitting}
                                            className="inline-flex items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-400/20"
                                        >
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-white/[0.05] bg-slate-950/30 p-3 text-[11px] text-slate-300 sm:grid-cols-4">
                                    <span>Bounds: <strong>{h.minReplicas}–{h.maxReplicas}</strong></span>
                                    <span>Replicas: <strong>{h.currentReplicas} cur / {h.desiredReplicas} des</strong></span>
                                    <span>
                                        {h.metricName.toUpperCase()}: <strong>{h.currentUtilizationPercent ?? '—'}%</strong> / {h.targetUtilizationPercent ?? '—'}%
                                    </span>
                                    <span>Last scale: <strong>{h.lastScaleTime ? new Date(h.lastScaleTime).toLocaleTimeString() : 'Never'}</strong></span>
                                </div>

                                {h.conditions.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {h.conditions.map((c, idx) => (
                                            <StatusBadge key={`${c.type}-${idx}`} status={`${c.type}: ${c.status}`} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </section>
            </aside>
        </div>
    )
}