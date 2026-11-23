import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2, X } from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { NamespaceDetailResponse } from '../../types/cluster'
import type { WorkloadOperationResponse } from '../../types/workload'

interface NamespaceDeleteModalProps {
    namespaceName: string
    onClose: () => void
    onDeleted: () => void
}

export function NamespaceDeleteModal({
                                         namespaceName,
                                         onClose,
                                         onDeleted,
                                     }: NamespaceDeleteModalProps) {
    const [details, setDetails] = useState<NamespaceDetailResponse | null>(null)
    const [loadingDetails, setLoadingDetails] = useState(true)
    const [confirmText, setConfirmText] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [result, setResult] = useState<WorkloadOperationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setConfirmText('')
        setResult(null)
        setError(null)
        const controller = new AbortController()
        setLoadingDetails(true)
        clusterApi
            .getNamespaceDetails(namespaceName, controller.signal)
            .then((res) => setDetails(res))
            .catch((cause) => {
                if (cause instanceof Error && cause.name === 'AbortError') return
                setDetails(null)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingDetails(false)
            })
        return () => controller.abort()
    }, [namespaceName])

    const matchesName = confirmText.trim() === namespaceName

    const handleDelete = async () => {
        if (!matchesName) return
        setDeleting(true)
        setError(null)
        setResult(null)
        try {
            const res = await clusterApi.deleteNamespace(namespaceName)
            setResult(res)
            onDeleted()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Namespace deletion failed')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deleting) onClose()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Confirm namespace deletion"
                className="w-full max-w-lg rounded-2xl border border-white/[0.09] bg-[#0b1220] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300">
                            Kubernetes / Destructive Action
                        </p>
                        <h2 className="mt-1.5 text-lg font-semibold text-white">
                            Delete Namespace: {namespaceName}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        aria-label="Close namespace delete dialog"
                        className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/5 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-4 flex gap-2.5 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-3.5 text-xs leading-5 text-rose-200">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0 text-rose-300" />
                    <p>
                        Deleting namespace <strong>{namespaceName}</strong> permanently deletes all namespaced
                        resources inside it (Pods, Deployments, StatefulSets, Services, ConfigMaps, Secrets,
                        and quotas) and may leave the namespace in <strong>Terminating</strong> until finalizers
                        complete.
                    </p>
                </div>

                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-300">Contained Resources</span>
                        {loadingDetails && <RefreshCw size={13} className="animate-spin text-cyan-300" />}
                    </div>
                    {details ? (
                        <div className="mt-3 grid grid-cols-2 gap-2.5 text-[11px] sm:grid-cols-3">
                            <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2">
                                <span className="text-slate-500">Pods:</span>{' '}
                                <strong className="text-slate-200">{details.pods.length}</strong>
                            </div>
                            <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2">
                                <span className="text-slate-500">Deployments:</span>{' '}
                                <strong className="text-slate-200">{details.deployments.length}</strong>
                            </div>
                            <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2">
                                <span className="text-slate-500">StatefulSets:</span>{' '}
                                <strong className="text-slate-200">{details.statefulSets.length}</strong>
                            </div>
                            <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2">
                                <span className="text-slate-500">Services:</span>{' '}
                                <strong className="text-slate-200">{details.services.length}</strong>
                            </div>
                            <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2">
                                <span className="text-slate-500">ConfigMaps:</span>{' '}
                                <strong className="text-slate-200">{details.configMaps.length}</strong>
                            </div>
                            <div className="rounded-lg border border-white/[0.05] bg-slate-950/30 p-2">
                                <span className="text-slate-500">Secrets:</span>{' '}
                                <strong className="text-slate-200">{details.secretsMetadataOnly.length}</strong>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-2 text-[11px] text-slate-500">
                            {loadingDetails ? 'Inspecting namespace contents...' : 'Resource breakdown unavailable; proceed carefully.'}
                        </p>
                    )}
                </div>

                {!result && (
                    <div className="mt-4 text-xs">
                        <label className="block text-slate-400">
                            Type <strong className="font-mono text-slate-200">{namespaceName}</strong> to confirm deletion
                        </label>
                        <input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={namespaceName}
                            disabled={deleting}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-100 outline-none focus:border-rose-400/50"
                        />
                    </div>
                )}

                {result && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-3 text-xs text-emerald-200">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                        <div>
                            <p className="font-semibold">
                                {result.operation}: {result.status}
                            </p>
                            <p className="mt-1 text-slate-300">{result.message}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-3 text-xs text-red-300">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        className="rounded-lg border border-white/[0.1] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                    >
                        {result ? 'Done' : 'Cancel'}
                    </button>
                    {!result && (
                        <button
                            type="button"
                            onClick={() => void handleDelete()}
                            disabled={deleting || !matchesName}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Trash2 size={14} />
                            {deleting ? 'Requesting deletion...' : 'Confirm Delete Namespace'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}