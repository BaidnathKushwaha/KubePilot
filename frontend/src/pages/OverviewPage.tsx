import { ArrowRight, Boxes, GitBranch, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

const nextSteps = [
  {
    icon: Boxes,
    title: 'Resource visibility',
    description: 'Browse nodes, pods, and workloads from one workspace.',
  },
  {
    icon: GitBranch,
    title: 'Cluster topology',
    description: 'Understand how resources relate to each other visually.',
  },
  {
    icon: ShieldCheck,
    title: 'Operational insight',
    description: 'Build toward actionable diagnostics and recommendations.',
  },
]

export function OverviewPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            Workspace / Overview
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
            Cluster overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            A single workspace for understanding and operating your Kubernetes environment.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-slate-400 sm:self-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Waiting for cluster connection
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-[#10263a] via-[#101c2d] to-[#111827] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-blue-500/[0.07] blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            Your operations workspace
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Your cluster, made easier to understand.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300/75">
            The KubePilot dashboard shell is ready. Connect the frontend to the cluster APIs
            to populate resource status, capacity, metrics, and topology.
          </p>
          <Link
            to="/topology"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Explore topology workspace
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="pointer-events-none absolute bottom-7 right-8 hidden h-36 w-56 items-center justify-center rounded-xl border border-cyan-100/10 bg-slate-950/20 lg:flex">
          <div className="absolute h-20 w-20 rounded-full border border-dashed border-cyan-200/20" />
          <div className="absolute h-12 w-12 rounded-full border border-cyan-200/20" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-200">
            <Boxes size={20} />
          </div>
          <span className="absolute left-7 top-8 h-2 w-2 rounded-full bg-cyan-300/80" />
          <span className="absolute right-8 top-12 h-2 w-2 rounded-full bg-blue-300/80" />
          <span className="absolute bottom-7 left-16 h-2 w-2 rounded-full bg-cyan-100/70" />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">What you can explore</h2>
            <p className="mt-1 text-xs text-slate-500">The main areas of the KubePilot workspace</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {nextSteps.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5 transition-colors hover:border-white/[0.13]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-200">
                  <Icon size={17} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-200">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.07] bg-[#0d1523] px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-200">No live cluster data yet</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This is an intentional empty state. Live counts and health indicators will be added
              when the dashboard API integration is implemented.
            </p>
          </div>
          <span className="w-fit rounded-md border border-amber-300/15 bg-amber-300/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-amber-200">
            Connection required
          </span>
        </div>
      </section>
    </div>
  )
}
