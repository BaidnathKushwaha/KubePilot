import { useState } from 'react'
import { CheckCircle2, FolderPlus, X } from 'lucide-react'
import { clusterApi } from '../../services/api'
import type { WorkloadOperationResponse } from '../../types/workload'

interface NamespaceCreateModalProps {
    onClose: () => void
    onCreated: () => void
}

const DNS_LABEL_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

export function NamespaceCreateModal({ onClose, onCreated }: NamespaceCreateModalProps) {
    const [name, setName] = useState('')
    const [labelsInput, setLabelsInput] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState<WorkloadOperationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || trimmed.length > 63 || !DNS_LABEL_REGEX.test(trimmed)) {
            setError('Namespace name must be 1–63 lowercase alphanumeric characters or hyphens, starting and ending with alphanumeric.')
            return
        }

        const labels: Record<string, string> = {}
        if (labelsInput.trim()) {
            for (const pair of labelsInput.split(',')) {
                const clean = pair.trim()
                if (!clean) continue
                const eqIdx = clean.indexOf('=')
                if (eqIdx <= 0) {
                    setError(`Invalid label "${clean}". Use key=value pairs separated by commas.`)
                    return
                }
                labels[clean.slice(0, eqIdx).trim()] = clean.slice(eqIdx + 1).trim()
            }
        }

        setSubmitting(true)
        setError(null)
        setResult(null)
        try {
            const res = await clusterApi.createNamespace(trimmed, labels)
            setResult(res)
            onCreated()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Failed to create namespace')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !submitting) onClose()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Create namespace"
                className="w-full max-w-lg rounded-2xl border border-white/[0.09] bg-[#0b1220] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                            Kubernetes / Namespaces
                        </p>
                        <h2 className="mt-1.5 text-lg font-semibold text-white">Create Namespace</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/5 disabled:opacity-50"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4 text-xs">
                    <div>
                        <label className="block text-slate-400">Namespace Name *</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. kubepilot-sandbox"
                            disabled={submitting}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400">Optional Labels (comma-separated key=value)</label>
                        <input
                            value={labelsInput}
                            onChange={(e) => setLabelsInput(e.target.value)}
                            placeholder="env=lab, owner=kubepilot"
                            disabled={submitting}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                        />
                    </div>

                    {result && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-3 text-emerald-200">
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                            <div>
                                <p className="font-semibold">{result.operation}: {result.status}</p>
                                <p className="mt-1 text-slate-300">{result.message}</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-xl border border-red-400/25 bg-red-400/[0.05] p-3 text-red-300">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="rounded-lg border border-white/[0.1] px-4 py-2 font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                        >
                            {result ? 'Done' : 'Cancel'}
                        </button>
                        {!result && (
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
                            >
                                <FolderPlus size={14} />
                                {submitting ? 'Creating...' : 'Create Namespace'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}