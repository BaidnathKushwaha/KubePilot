import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Cpu, HardDrive, RefreshCw, Server } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { clusterApi } from '../services/api'
import type { KubernetesNode, NodeMetrics, PodMetrics } from '../types/cluster'
import { useNamespace } from '../context/NamespaceContext'

const REFRESH_MS = 15_000
const GIB = 1024 ** 3

function quantity(value?: string): number | null {
  if (!value) return null
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)([a-zA-Z]*)$/)
  if (!match) return null
  const factors: Record<string, number> = {
    '': 1, n: 1e-9, u: 1e-6, m: 1e-3,
    k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12,
    P: 1e15, E: 1e18, Ki: 1024, Mi: 1024 ** 2,
    Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5, Ei: 1024 ** 6,
  }
  const factor = factors[match[2]]
  return factor === undefined ? null : Number(match[1]) * factor
}

const bytes = (value: number) => value >= GIB
  ? `${(value / GIB).toFixed(2)} GiB`
  : value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MiB`
  : value >= 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${value.toFixed(0)} B`

const cpu = (value: number) => value >= 1000
  ? `${(value / 1000).toFixed(2)} cores`
  : `${value.toFixed(0)} m`

function Bar({ value, capacity, label }: { value: number; capacity: number | null; label: string }) {
  const percent = capacity && capacity > 0 ? Math.min(value / capacity * 100, 100) : null
  const color = percent !== null && percent >= 85 ? 'bg-rose-400' : percent !== null && percent >= 65 ? 'bg-amber-400' : 'bg-cyan-400'
  return <div>
    <div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-slate-400">{label}</span><span className="text-slate-200 tabular-nums">{percent === null ? 'Capacity unavailable' : `${percent.toFixed(1)}%`}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent ?? 0}%` }} /></div>
  </div>
}

export function MetricsPage() {
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics[]>([])
  const [podMetrics, setPodMetrics] = useState<PodMetrics[]>([])
  const [nodes, setNodes] = useState<KubernetesNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const { namespace } = useNamespace()

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    try {
      const [nodeData, podData, nodeInventory] = await Promise.all([
        clusterApi.getNodeMetrics(signal),
        clusterApi.getPodMetrics(namespace || undefined, signal),
        clusterApi.getNodes(signal),
      ])
      setNodeMetrics(nodeData)
      setPodMetrics(podData)
      setNodes(nodeInventory)
      setUpdatedAt(new Date().toLocaleTimeString())
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unable to load resource metrics')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [namespace])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const interval = window.setInterval(() => void refresh(), REFRESH_MS)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [refresh])

  const rows = useMemo(() => nodeMetrics.map((metric) => {
    const node = nodes.find((item) => item.name === metric.name)
    const cpuCapacity = quantity(node?.capacity?.cpu)
    return {
      ...metric,
      cpuCapacity: cpuCapacity === null ? null : cpuCapacity * 1000,
      memoryCapacity: quantity(node?.capacity?.memory),
    }
  }), [nodeMetrics, nodes])

  const topPods = useMemo(() => [...podMetrics]
    .sort((a, b) => b.cpuMilliCores - a.cpuMilliCores).slice(0, 10), [podMetrics])
  const totalCpu = nodeMetrics.reduce((sum, metric) => sum + metric.cpuMilliCores, 0)
  const totalMemory = nodeMetrics.reduce((sum, metric) => sum + metric.memoryBytes, 0)
  const timestamp = nodeMetrics[0]?.timestamp ?? podMetrics[0]?.timestamp

  return <div className="space-y-7">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Observe / Resources</p><h1 className="mt-3 text-2xl font-semibold text-white sm:text-[30px]">Resource metrics</h1><p className="mt-2 text-sm text-slate-400">CPU and memory consumption reported by the Kubernetes Metrics API.</p></div>
      <div className="flex items-center gap-3"><span className="text-[11px] text-slate-500">{updatedAt ? `Updated ${updatedAt}` : 'Waiting for metrics'}</span><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh</button></div>
    </section>
    <RequestState loading={loading && nodeMetrics.length === 0 && podMetrics.length === 0} error={error && nodeMetrics.length === 0 && podMetrics.length === 0 ? error : null} onRetry={() => void refresh()}>
      {nodeMetrics.length === 0 && podMetrics.length === 0 && !error && <div role="status" className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-xs text-amber-200">The Metrics API returned no measurements. Confirm that metrics-server is installed and reporting data.</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><Cpu size={15} className="text-cyan-200"/>Cluster CPU usage</div><p className="mt-3 text-2xl font-semibold text-white">{cpu(totalCpu)}</p><p className="mt-1 text-[11px] text-slate-500">Aggregate usage across nodes</p></article>
        <article className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><HardDrive size={15} className="text-cyan-200"/>Cluster memory usage</div><p className="mt-3 text-2xl font-semibold text-white">{bytes(totalMemory)}</p><p className="mt-1 text-[11px] text-slate-500">Aggregate usage across nodes</p></article>
      </div>
      <section className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
        <div className="mb-5 flex items-center gap-2"><Server size={16} className="text-cyan-200"/><h2 className="text-sm font-semibold text-slate-100">Node resource utilization</h2></div>
        {rows.length === 0 ? <p className="text-xs text-slate-500">No node metrics currently available from the Kubernetes Metrics API.</p> : <div className="space-y-7">{rows.map((node) => <div key={node.name} className="space-y-4"><div className="flex justify-between"><p className="text-sm font-medium text-slate-200">{node.name}</p><span className="text-[10px] text-slate-500">Window: {node.window || 'Not reported'}</span></div><div className="grid gap-5 md:grid-cols-2"><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">CPU</span><span className="text-slate-200">{cpu(node.cpuMilliCores)} / {node.cpuCapacity === null ? 'Unknown' : cpu(node.cpuCapacity)}</span></div><Bar value={node.cpuMilliCores} capacity={node.cpuCapacity} label="CPU capacity used"/></div><div><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">Memory</span><span className="text-slate-200">{bytes(node.memoryBytes)} / {node.memoryCapacity === null ? 'Unknown' : bytes(node.memoryCapacity)}</span></div><Bar value={node.memoryBytes} capacity={node.memoryCapacity} label="Memory capacity used"/></div></div></div>)}</div>}
      </section>
      <section className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
        <div className="mb-5 flex items-center gap-2"><Activity size={16} className="text-cyan-200"/><h2 className="text-sm font-semibold text-slate-100">Top pods by CPU usage {namespace ? `in ${namespace}` : '(all namespaces)'}</h2></div>
        {topPods.length === 0 ? <p className="text-xs text-slate-500">No pod metrics currently available.</p> : <div className="space-y-4">{topPods.map((pod) => { const maximum = Math.max(...topPods.map((item) => item.cpuMilliCores), 1); return <div key={`${pod.namespace}/${pod.name}`}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><div className="min-w-0"><p className="truncate font-medium text-slate-200">{pod.name}</p><p className="text-[10px] text-slate-500">{pod.namespace}</p></div><div className="shrink-0 text-right"><p className="text-slate-200">{cpu(pod.cpuMilliCores)}</p><p className="text-[10px] text-slate-500">{bytes(pod.memoryBytes)}</p></div></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{width:`${pod.cpuMilliCores / maximum * 100}%`}}/></div></div>})}</div>}
      </section>
      {error && (nodeMetrics.length > 0 || podMetrics.length > 0) && <p role="status" className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-xs text-amber-200">Metrics refresh failed: {error}. Displaying the last successful snapshot.</p>}
      {timestamp && <p className="text-[10px] text-slate-600">Metrics API timestamp: {new Date(timestamp).toLocaleString()}. Refreshes every 15 seconds. This page shows current snapshots, not historical trends.</p>}

    </RequestState>
  </div>
}
