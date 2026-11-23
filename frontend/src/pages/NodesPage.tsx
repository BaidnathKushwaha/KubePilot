import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Server } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { clusterApi } from '../services/api'
import type { KubernetesNode, KubernetesPod, NodeMetrics } from '../types/cluster'
import { NodeDetailsPanel } from '../components/dashboard/NodeDetailsPanel'

function formatBytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MiB`
  return `${value} B`
}

function formatCpu(milliCores: number | undefined): string {
  if (milliCores === undefined || !Number.isFinite(milliCores)) return '—'
  return milliCores >= 1000 ? `${(milliCores / 1000).toFixed(2)} cores` : `${milliCores} m`
}

export function NodesPage() {
  const [nodes, setNodes] = useState<KubernetesNode[]>([])
  const [pods, setPods] = useState<KubernetesPod[]>([])
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedNode, setSelectedNode] = useState<KubernetesNode | null>(null)

  const loadNodes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [nodeList, podList] = await Promise.all([
        clusterApi.getNodes(signal),
        clusterApi.getPods(undefined, signal),
      ])
      setNodes(nodeList)
      setPods(podList)
      try {
        setNodeMetrics(await clusterApi.getNodeMetrics(signal))
      } catch {
        setNodeMetrics([])
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unexpected error while loading nodes')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadNodes(controller.signal)
    return () => controller.abort()
  }, [loadNodes])

  const filteredNodes = useMemo(() => nodes.filter((node) =>
      [
        node.name,
        node.status,
        node.kubernetesVersion,
        node.architecture,
        node.internalIP ?? '',
        node.osImage ?? '',
        node.containerRuntime ?? '',
        node.unschedulable ? 'unschedulable' : 'schedulable',
      ].some((value) => value?.toLowerCase().includes(search.toLowerCase())),
  ), [nodes, search])

  const podCountByNode = useMemo(() => {
    const counts = new Map<string, number>()
    for (const pod of pods) {
      if (pod.nodeName) {
        counts.set(pod.nodeName, (counts.get(pod.nodeName) ?? 0) + 1)
      }
    }
    return counts
  }, [pods])

  const metricsByNode = useMemo(() => {
    const map = new Map<string, NodeMetrics>()
    for (const m of nodeMetrics) {
      map.set(m.name, m)
    }
    return map
  }, [nodeMetrics])

  return (
      <div className="space-y-7">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Workspace / Compute</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">Nodes</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Cluster-scoped machines registered with the Kubernetes control plane. Namespace filtering does not apply to nodes.</p>
          </div>
          <button type="button" onClick={() => void loadNodes()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50 sm:self-auto">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </section>

        <RequestState loading={loading && nodes.length === 0} error={error && nodes.length === 0 ? error : null} onRetry={() => void loadNodes()}>
          <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1523]">
            <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2"><Server size={16} className="text-cyan-200" /><h2 className="text-sm font-semibold text-slate-100">Cluster nodes</h2><span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">{nodes.length} total</span></div>
              <label className="relative block sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes..." className="w-full rounded-lg border border-white/10 bg-slate-950/40 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40" />
              </label>
            </div>
            {error && <p role="status" className="px-4 py-2 text-xs text-amber-300">Refresh failed: {error}. Showing previously loaded data.</p>}
            {filteredNodes.length === 0 ? (
                <div className="px-5 py-14 text-center"><p className="text-sm font-medium text-slate-300">{nodes.length === 0 ? 'No nodes found' : 'No matching nodes'}</p><p className="mt-1 text-xs text-slate-500">{nodes.length === 0 ? 'The API returned an empty node list.' : 'Try a different search term.'}</p></div>
            ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1160px] text-left text-xs">
                    <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Node name</th>
                      <th className="px-4 py-3 font-semibold">Health</th>
                      <th className="px-4 py-3 font-semibold">Scheduling</th>
                      <th className="px-4 py-3 font-semibold">Internal IP</th>
                      <th className="px-4 py-3 font-semibold">Version / OS</th>
                      <th className="px-4 py-3 font-semibold">CPU (Cap / Alloc / Use)</th>
                      <th className="px-4 py-3 font-semibold">Memory (Cap / Alloc / Use)</th>
                      <th className="px-4 py-3 font-semibold">Pods</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.055]">
                    {filteredNodes.map((node) => {
                      const metric = metricsByNode.get(node.name)
                      const scheduledCount = podCountByNode.get(node.name) ?? 0
                      const podCap = node.podCapacity ?? node.capacity?.pods ?? '—'
                      return (
                          <tr key={node.name} className="cursor-pointer transition hover:bg-white/[0.045]" onClick={() => setSelectedNode(node)}>
                            <td className="px-4 py-4 font-medium text-slate-200">
                              <div>{node.name}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">{node.architecture || '—'} · {node.containerRuntime || '—'}</div>
                            </td>
                            <td className="px-4 py-4"><StatusBadge status={node.status} /></td>
                            <td className="px-4 py-4"><StatusBadge status={node.unschedulable ? 'Unschedulable' : 'Schedulable'} /></td>
                            <td className="px-4 py-4 font-mono text-slate-400">{node.internalIP || '—'}</td>
                            <td className="px-4 py-4 text-slate-400">
                              <div>{node.kubernetesVersion || '—'}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">{node.osImage || node.operatingSystem || '—'}</div>
                            </td>
                            <td className="px-4 py-4 tabular-nums text-slate-300">
                              <div>{node.capacity?.cpu ?? '—'} / {node.allocatable?.cpu ?? '—'}</div>
                              <div className="mt-0.5 text-[10px] text-cyan-300">{metric ? formatCpu(metric.cpuMilliCores) : 'Usage N/A'}</div>
                            </td>
                            <td className="px-4 py-4 tabular-nums text-slate-300">
                              <div>{node.capacity?.memory ?? '—'} / {node.allocatable?.memory ?? '—'}</div>
                              <div className="mt-0.5 text-[10px] text-cyan-300">{metric ? formatBytes(metric.memoryBytes) : 'Usage N/A'}</div>
                            </td>
                            <td className="px-4 py-4 tabular-nums text-slate-300">{scheduledCount} / {podCap}</td>
                          </tr>
                      )
                    })}
                    </tbody>
                  </table>
                </div>
            )}
          </section>
        </RequestState>
        {selectedNode && (
            <NodeDetailsPanel
                nodeName={selectedNode.name}
                initialPods={pods.filter((p) => p.nodeName === selectedNode.name)}
                onClose={() => setSelectedNode(null)}
                onNodeUpdated={() => {
                  void loadNodes()
                }}
            />
        )}
      </div>
  )
}