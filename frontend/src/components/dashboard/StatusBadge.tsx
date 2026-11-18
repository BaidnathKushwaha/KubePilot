interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase()
  const styles =
    normalized === 'ready' || normalized === 'running' || normalized === 'true'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
      : normalized === 'pending' || normalized === 'unknown'
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
        : normalized === 'failed' || normalized === 'notready' || normalized === 'false'
          ? 'border-rose-400/20 bg-rose-400/10 text-rose-300'
          : 'border-slate-400/20 bg-slate-400/10 text-slate-300'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || 'Unknown'}
    </span>
  )
}
