import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Cpu, HardDrive, Layers, RefreshCw, Server } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { clusterApi } from '../services/api'
import type { KubernetesNode, NodeMetrics, PodMetrics } from '../types/cluster'
import type { WorkloadPressureResponse } from '../types/traffic'
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

const bytes = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value >= GIB
      ? `${(value / GIB).toFixed(2)} GiB`
      : value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MiB`
          : value >= 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${value.toFixed(0)} B`
}

const cpu = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value >= 1000
      ? `${(value / 1000).toFixed(2)} cores`
      : `${value.toFixed(0)} m`
}

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
  const [pressure, setPressure] = useState<WorkloadPressureResponse | null>(null)
  const [cpuThreshold, setCpuThreshold] = useState<number>(80)
  const [memThreshold, setMemThreshold] = useState<number>(80)
  const [nearLimitThreshold, setNearLimitThreshold] = useState<number>(85)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const { namespace } = useNamespace()

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    try {
      const [nodeData, podData, nodeInventory, workloadPressure] = await Promise.all([
        clusterApi.getNodeMetrics(signal),
        clusterApi.getPodMetrics(namespace || undefined, signal),
        clusterApi.getNodes(signal),
        clusterApi.getWorkloadPressure(
            {
              namespace: namespace || undefined,
              cpuThresholdPercent: cpuThreshold,
              memoryThresholdPercent: memThreshold,
              nearLimitPercent: nearLimitThreshold,
            },
            signal,
        ).catch(() => null),
      ])
      setNodeMetrics(nodeData)
      setPodMetrics(podData)
      setNodes(nodeInventory)
      if (workloadPressure) setPressure(workloadPressure)
      setUpdatedAt(new Date().toLocaleTimeString())
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unable to load resource metrics')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [namespace, cpuThreshold, memThreshold, nearLimitThreshold])

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
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Observe / Resources</p><h1 className="mt-3 text-2xl font-semibold text-white sm:text-[30px]">Resource metrics</h1><p className="mt-2 text-sm text-slate-400">CPU and memory consumption, requests/limits, and threshold overload status.</p></div>
      <div className="flex items-center gap-3"><span className="text-[11px] text-slate-500">{updatedAt ? `Updated ${updatedAt}` : 'Waiting for metrics'}</span><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh</button></div>
    </section>
    <RequestState loading={loading && nodeMetrics.length === 0 && podMetrics.length === 0} error={error && nodeMetrics.length === 0 && podMetrics.length === 0 ? error : null} onRetry={() => void refresh()}>
      {nodeMetrics.length === 0 && podMetrics.length === 0 && !error && <div role="status" className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-xs text-amber-200">The Metrics API returned no measurements. Confirm that metrics-server is installed and reporting data.</div>}
      {pressure && (
          <div role="status" className="rounded-xl border border-white/[0.07] bg-[#0d1523] px-4 py-3 text-xs text-slate-400">
            Traffic telemetry: <strong className="text-slate-200">{pressure.trafficMetricsAvailable ? 'Available' : 'Unavailable'}</strong> — {pressure.trafficStatusNote}
          </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><Cpu size={15} className="text-cyan-200"/>Cluster CPU usage</div><p className="mt-3 text-2xl font-semibold text-white">{cpu(totalCpu)}</p><p className="mt-1 text-[11px] text-slate-500">Aggregate usage across nodes</p></article>
        <article className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><HardDrive size={15} className="text-cyan-200"/>Cluster memory usage</div><p className="mt-3 text-2xl font-semibold text-white">{bytes(totalMemory)}</p><p className="mt-1 text-[11px] text-slate-500">Aggregate usage across nodes</p></article>
      </div>

      {/* Overload Thresholds & Warnings */}
      <section className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.06] pb-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-300" />
            <h2 className="text-sm font-semibold text-slate-100">Threshold Overload Detection</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 text-slate-400">
              CPU %
              <input
                  type="number"
                  min={1}
                  max={100}
                  value={cpuThreshold}
                  onChange={(e) => setCpuThreshold(Number(e.target.value) || 80)}
                  className="w-16 rounded border border-white/10 bg-slate-950/50 px-2 py-1 text-slate-200"
              />
            </label>
            <label className="flex items-center gap-1.5 text-slate-400">
              Mem %
              <input
                  type="number"
                  min={1}
                  max={100}
                  value={memThreshold}
                  onChange={(e) => setMemThreshold(Number(e.target.value) || 80)}
                  className="w-16 rounded border border-white/10 bg-slate-950/50 px-2 py-1 text-slate-200"
              />
            </label>
            <label className="flex items-center gap-1.5 text-slate-400">
              Near Limit %
              <input
                  type="number"
                  min={1}
                  max={100}
                  value={nearLimitThreshold}
                  onChange={(e) => setNearLimitThreshold(Number(e.target.value) || 85)}
                  className="w-16 rounded border border-white/10 bg-slate-950/50 px-2 py-1 text-slate-200"
              />
            </label>
          </div>
        </div>

        <div className="mt-4">
          {!pressure || pressure.warnings.length === 0 ? (
              <p className="text-xs text-slate-500">No workloads currently exceed configured CPU, memory, or limit thresholds.</p>
          ) : (
              <div className="space-y-2">
                {pressure.warnings.map((w) => (
                    <div key={w.warningKey} className="flex items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-2.5 text-xs text-amber-200">
                      <span>{w.message}</span>
                      <StatusBadge status={w.severity} />
                    </div>
                ))}
              </div>
          )}
        </div>
      </section>

      {/* Workload Resource Consumption, Requests & Limits */}
      <section className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Layers size={16} className="text-cyan-200" />
          <h2 className="text-sm font-semibold text-slate-100">
            Workload CPU & Memory (Usage vs Requests / Limits) {namespace ? `in ${namespace}` : '(all namespaces)'}
          </h2>
        </div>
        {!pressure || pressure.workloads.length === 0 ? (
            <p className="text-xs text-slate-500">No Deployments or StatefulSets found in scope.</p>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Workload</th>
                  <th className="px-4 py-3 font-semibold">Namespace</th>
                  <th className="px-4 py-3 font-semibold">Ready</th>
                  <th className="px-4 py-3 font-semibold">CPU (Use / Req / Lim)</th>
                  <th className="px-4 py-3 font-semibold">Memory (Use / Req / Lim)</th>
                  <th className="px-4 py-3 font-semibold">Pressure</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.055]">
                {pressure.workloads.map((w) => (
                    <tr key={`${w.kind}/${w.namespace}/${w.name}`} className="hover:bg-white/[0.025]">
                      <td className="px-4 py-3.5 font-medium text-slate-200">
                        <div>{w.name}</div>
                        <div className="text-[10px] text-slate-500">{w.kind}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">{w.namespace}</td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-300">{w.readyReplicas} / {w.desiredReplicas}</td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-300">
                        <div>
                          {w.metricsAvailable ? cpu(w.cpuUsageMilliCores) : 'Metrics N/A'}{' '}
                          {w.cpuUsagePercent !== null ? <span className="text-cyan-300">({w.cpuUsagePercent}%)</span> : null}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Req: {cpu(w.cpuRequestMilliCores)} · Lim: {cpu(w.cpuLimitMilliCores)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-300">
                        <div>
                          {w.metricsAvailable ? bytes(w.memoryUsageBytes) : 'Metrics N/A'}{' '}
                          {w.memoryUsagePercent !== null ? <span className="text-cyan-300">({w.memoryUsagePercent}%)</span> : null}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Req: {bytes(w.memoryRequestBytes)} · Lim: {bytes(w.memoryLimitBytes)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={w.overloaded ? 'Warning' : w.metricsAvailable ? 'Healthy' : 'Unknown'} />
                      </td>
                    </tr>
                ))}
                </tbody>
              </table>
            </div>
        )}
      </section>

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