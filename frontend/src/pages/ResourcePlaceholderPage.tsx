import { ArrowUpRight, CircleDashed } from 'lucide-react'

interface ResourcePlaceholderPageProps {
  title: string
  description: string
  eyebrow: string
}

export function ResourcePlaceholderPage({
  title,
  description,
  eyebrow,
}: ResourcePlaceholderPageProps) {
  return (
    <div className="space-y-7">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
          Workspace / {eyebrow}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </section>

      <section className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#0c1421] px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200">
          <CircleDashed size={23} strokeWidth={1.6} />
        </div>
        <h2 className="mt-5 text-base font-semibold text-slate-200">{title} workspace</h2>
        <p className="mt-2 max-w-md text-xs leading-6 text-slate-500">
          This section is reserved for the {title.toLowerCase()} interface. Its data table,
          filters, and resource details will be implemented in the corresponding frontend
          milestones.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] text-slate-400">
          <ArrowUpRight size={13} />
          Navigation is active · Feature implementation pending
        </div>
      </section>
    </div>
  )
}
