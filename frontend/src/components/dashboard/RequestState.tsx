import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

interface RequestStateProps {
  loading: boolean
  error: string | null
  onRetry: () => void
  loadingLabel?: string
  errorTitle?: string
  children?: ReactNode
}

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading cluster data" className="space-y-4">
      <span className="sr-only">Loading cluster data...</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(item => <div key={item} className="h-28 animate-pulse rounded-xl border border-white/[0.06] bg-[#0d1523] p-5">
          <div className="h-3 w-24 rounded bg-slate-700/60" />
          <div className="mt-5 h-7 w-16 rounded bg-slate-700/60" />
          <div className="mt-3 h-2 w-32 rounded bg-slate-800" />
        </div>)}
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-[#0d1523] p-5">
        <div className="mb-5 h-4 w-36 animate-pulse rounded bg-slate-700/60" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-9 animate-pulse rounded-lg bg-slate-800/70" />)}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <LoaderCircle size={14} className="animate-spin text-cyan-300" />
        {label}
      </div>
    </div>
  )
}

export function RequestState({
  loading,
  error,
  onRetry,
  loadingLabel = 'Loading cluster data...',
  errorTitle = 'Unable to load cluster data',
  children,
}: RequestStateProps) {
  if (loading) return <LoadingSkeleton label={loadingLabel} />

  if (error) {
    return (
      <div role="alert" className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-rose-300/15 bg-rose-300/[0.035] px-5 py-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-300/10">
          <AlertTriangle size={21} className="text-rose-300" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-100">{errorTitle}</p>
        <p className="mt-2 max-w-xl break-words text-xs leading-5 text-slate-400">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    )
  }

  return <>{children}</>
}
