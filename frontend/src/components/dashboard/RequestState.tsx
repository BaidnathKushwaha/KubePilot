import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'

interface RequestStateProps {
  loading: boolean
  error: string | null
  onRetry: () => void
  children?: React.ReactNode
}

export function RequestState({ loading, error, onRetry, children }: RequestStateProps) {
  if (loading) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-[#0d1523] text-slate-400">
        <LoaderCircle size={22} className="animate-spin text-cyan-300" />
        <p className="mt-3 text-xs">Loading cluster data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-rose-300/15 bg-rose-300/[0.035] px-5 text-center">
        <AlertTriangle size={22} className="text-rose-300" />
        <p className="mt-3 text-sm font-medium text-slate-200">Unable to load cluster data</p>
        <p className="mt-1 max-w-xl break-words text-xs leading-5 text-slate-500">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
        >
          <RefreshCw size={13} /> Try again
        </button>
      </div>
    )
  }

  return <>{children}</>
}
