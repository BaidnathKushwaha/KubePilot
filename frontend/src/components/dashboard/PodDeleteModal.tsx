import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { KubernetesPod } from '../../types/cluster'
import type { WorkloadOperationResponse } from '../../types/workload'

interface PodDeleteModalProps {
    pod: KubernetesPod
    onClose: () => void
    onDeleted: () => void
}

export function PodDeleteModal({ pod, onClose, onDeleted }: PodDeleteModalProps) {
    const [deleting, setDeleting] = useState(false)
    const [result, setResult] = useState<WorkloadOperationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const isControllerManaged = Boolean(pod.ownerKind)

    const handleConfirmDelete = async () => {
        setDeleting(true)
        setError(null)
        setResult(null)

        try {
            const response = await clusterApi.deletePod(pod.namespace, pod.name)
            setResult(response)
            onDeleted()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Pod deletion failed')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deleting) {
                    onClose()
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Confirm pod deletion"
                className="w-full max-w-lg rounded-2xl border border-white/[0.09] bg-[#0b1220] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300">
                            Kubernetes / Pod Action
                        </p>
                        <h2 className="mt-1.5 text-lg font-semibold text-white">
                            Delete Pod
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        aria-label="Close delete dialog"
                        className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/5 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                <dl className="mt-4 space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs">
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Pod name</dt>
                        <dd className="break-all font-mono text-slate-200">{pod.name}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Namespace</dt>
                        <dd className="text-slate-200">{pod.namespace}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Ownership</dt>
                        <dd className="text-slate-200">
                            {isControllerManaged
                                ? `${pod.ownerKind}${pod.ownerName ? `: ${pod.ownerName}` : ''}`
                                : 'Standalone Pod (no controller owner)'}
                        </dd>
                    </div>
                </dl>

                <div
                    className={`mt-4 flex gap-2.5 rounded-xl border p-3.5 text-xs leading-5 ${
                        isControllerManaged
                            ? 'border-amber-400/25 bg-amber-400/[0.05] text-amber-200'
                            : 'border-rose-400/25 bg-rose-400/[0.05] text-rose-200'
                    }`}
                >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>
                        {isControllerManaged ? (
                            <p>
                                This pod is managed by <strong>{pod.ownerKind}</strong>
                                {pod.ownerName ? ` "${pod.ownerName}"` : ''}. Deleting the pod
                                will terminate it and let the controller recreate a replacement pod;
                                it does <strong>not</strong> permanently remove the workload.
                            </p>
                        ) : (
                            <p>
                                This pod is <strong>not</strong> managed by a controller. Deleting it
                                terminates the pod directly without automatic controller recreation.
                            </p>
                        )}
                    </div>
                </div>

                {result && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-3.5 text-xs text-emerald-200">
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
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-400/[0.05] p-3.5 text-xs text-red-300">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
                        <p className="break-all">{error}</p>
                    </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-2.5">
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
                            onClick={() => void handleConfirmDelete()}
                            disabled={deleting}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50"
                        >
                            <Trash2 size={14} />
                            {deleting ? 'Requesting deletion...' : 'Confirm Delete'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}