import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone?: 'cyan' | 'green' | 'amber' | 'rose' | 'blue'
}

const tones = {
  cyan: 'border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-200',
  green: 'border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200',
  amber: 'border-amber-300/15 bg-amber-300/[0.07] text-amber-200',
  rose: 'border-rose-300/15 bg-rose-300/[0.07] text-rose-200',
  blue: 'border-blue-300/15 bg-blue-300/[0.07] text-blue-200',
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'cyan' }: MetricCardProps) {
  return (
    <article className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">{detail}</p>
    </article>
  )
}
