import { useCallback, useEffect, useState } from 'react'
import { Activity, Boxes, Cpu, Database, GitBranch, HardDrive, RefreshCw, Server, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RequestState } from '../components/dashboard/RequestState'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { clusterApi } from '../services/api'
import type { ClusterOverview } from '../types/cluster'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unavailable'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(exponent >= 3 ? 2 : 1)} ${units[exponent]}`
}

export function OverviewPage() {
  const [overview, setOverview] = useState<ClusterOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await clusterApi.getOverview(signal)
      setOverview(data)
      setUpdatedAt(new Date().toLocaleTimeString())
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unexpected error while loading overview')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadOverview(controller.signal)
    return () => controller.abort()
  }, [loadOverview])

  const metricsAvailable = Boolean(overview?.metricsTimestamp)
  const cards = overview ? [
    { label: 'Total nodes', value: String(overview.nodesTotal), detail: `${overview.nodesReady} ready · ${overview.nodesNotReady} not ready`, icon: Server, tone: 'cyan' as const },
    { label: 'Total pods', value: String(overview.podsTotal), detail: `${overview.podsRunning} running · ${overview.podsPending} pending`, icon: Boxes, tone: 'green' as const },
    { label: 'Namespaces', value: String(overview.namespacesTotal), detail: 'Namespaces discovered in this cluster', icon: Database, tone: 'blue' as const },
    { label: 'Failed pods', value: String(overview.podsFailed), detail: `${overview.podsNotReady} running pods not ready`, icon: Activity, tone: overview.podsFailed > 0 ? 'rose' as const : 'green' as const },
    { label: 'CPU usage', value: metricsAvailable ? `${(overview.cpuMilliCores / 1000).toFixed(2)} cores` : 'Unavailable', detail: metricsAvailable ? 'Aggregate usage reported by Metrics API' : 'Node metrics are not available', icon: Cpu, tone: 'amber' as const },
    { label: 'Memory usage', value: metricsAvailable ? formatBytes(overview.memoryBytes) : 'Unavailable', detail: metricsAvailable ? 'Aggregate usage reported by Metrics API' : 'Node metrics are not available', icon: HardDrive, tone: 'blue' as const },
  ] : []

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Workspace / Overview</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">Cluster overview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Live inventory and resource usage discovered from your Kubernetes cluster.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={error ? 'Unavailable' : loading ? 'Connecting' : 'Connected'} />
          <button type="button" onClick={() => void loadOverview()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </section>

      <RequestState loading={loading && !overview} error={error && !overview ? error : null} onRetry={() => void loadOverview()}>
        {overview && (
          <>
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Cluster resources</h2>
                  <p className="mt-1 text-xs text-slate-500">Cluster-wide snapshot. Namespace selection applies to namespaced resource views.</p>
                </div>
                {updatedAt && <p className="text-[11px] text-slate-500">Updated at {updatedAt}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => <MetricCard key={card.label} {...card} />)}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-cyan-200" /><h2 className="text-sm font-semibold text-slate-100">Node health</h2></div>
                <div className="mt-5 flex items-end justify-between">
                  <p className="text-3xl font-semibold text-white tabular-nums">{overview.nodesReady}<span className="ml-1 text-sm font-normal text-slate-500">/ {overview.nodesTotal}</span></p>
                  <StatusBadge status={overview.nodesNotReady === 0 ? 'Ready' : 'Attention required'} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${overview.nodesTotal ? (overview.nodesReady / overview.nodesTotal) * 100 : 0}%` }} /></div>
                <p className="mt-2 text-[11px] text-slate-500">{overview.nodesNotReady} node(s) not ready</p>
                <Link to="/nodes" className="mt-4 inline-flex items-center text-xs font-medium text-cyan-200 hover:text-cyan-100">View nodes <GitBranch size={13} className="ml-1" /></Link>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
                <div className="flex items-center gap-2"><Boxes size={16} className="text-cyan-200" /><h2 className="text-sm font-semibold text-slate-100">Pod status</h2></div>
                <div className="mt-5 flex items-end justify-between">
                  <p className="text-3xl font-semibold text-white tabular-nums">{overview.podsRunning}<span className="ml-1 text-sm font-normal text-slate-500">/ {overview.podsTotal}</span></p>
                  <StatusBadge status={overview.podsFailed > 0 ? 'Failed pods detected' : 'Healthy'} />
                </div>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-emerald-400" style={{ width: `${overview.podsTotal ? (overview.podsRunning / overview.podsTotal) * 100 : 0}%` }} />
                  <div className="h-full bg-amber-400" style={{ width: `${overview.podsTotal ? (overview.podsPending / overview.podsTotal) * 100 : 0}%` }} />
                  <div className="h-full bg-rose-400" style={{ width: `${overview.podsTotal ? (overview.podsFailed / overview.podsTotal) * 100 : 0}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{overview.podsRunning} running · {overview.podsPending} pending · {overview.podsFailed} failed · {overview.podsSucceeded} succeeded</p>
                <Link to="/pods" className="mt-4 inline-flex items-center text-xs font-medium text-cyan-200 hover:text-cyan-100">View pods <GitBranch size={13} className="ml-1" /></Link>
              </div>
            </section>
          </>
        )}
      </RequestState>
      {error && overview && <p role="status" className="text-xs text-amber-300">Refresh failed: {error}. Showing the last successfully loaded snapshot.</p>}
    </div>
  )
}
