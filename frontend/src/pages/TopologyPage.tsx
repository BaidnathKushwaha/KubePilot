import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background, Controls, MiniMap, ReactFlow, Handle, Position,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GitBranch, RefreshCw, Search, X } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { clusterApi } from '../services/api'
import type { ClusterTopology, TopologyNode } from '../types/cluster'

const LAYERS: Record<string, number> = {
  Ingress: 0, Service: 1, Deployment: 2, StatefulSet: 2,
  EndpointSlice: 3, Pod: 4, Node: 5,
}
const NODE_COLORS: Record<string, string> = {
  Ingress: 'border-violet-400/40 bg-violet-400/10',
  Service: 'border-cyan-300/40 bg-cyan-300/10',
  Deployment: 'border-blue-400/40 bg-blue-400/10',
  StatefulSet: 'border-indigo-400/40 bg-indigo-400/10',
  EndpointSlice: 'border-amber-300/40 bg-amber-300/10',
  Pod: 'border-emerald-400/40 bg-emerald-400/10',
  Node: 'border-slate-400/40 bg-slate-400/10',
}

function ResourceNode({ data }: NodeProps) {
  const resource = data.resource as TopologyNode
  return <div className={`w-[232px] rounded-xl border px-3.5 py-3.5 shadow-lg shadow-black/20 transition-colors ${NODE_COLORS[resource.type] ?? 'border-white/15 bg-slate-800'}`}>
    <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-cyan-300"/>
    <div className="flex items-center justify-between gap-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{resource.type}</div>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70"/>
    </div>
    <div className="mt-2 break-words text-[13px] font-semibold leading-5 text-slate-100" title={resource.name}>{resource.name}</div>
    <div className="mt-1.5 break-words text-[11px] leading-4 text-slate-400">{resource.namespace ?? 'Cluster scope'} · {resource.status ?? 'Status unavailable'}</div>
    <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-cyan-300"/>
  </div>
}

const nodeTypes = { resource: ResourceNode }

export function TopologyPage() {
  const [topology, setTopology] = useState<ClusterTopology>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namespace, setNamespace] = useState('')
  const [namespaceOptions, setNamespaceOptions] = useState<string[]>([])
  const [selected, setSelected] = useState<TopologyNode | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const result = await clusterApi.getTopology(namespace || undefined, signal)
      setTopology(result)
      if (!namespace) setNamespaceOptions([...new Set(result.nodes.map((node) => node.namespace).filter((value): value is string => Boolean(value)))].sort())
      setSelected(null)
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unable to load cluster topology')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [namespace])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const namespaces = namespaceOptions

  const visibleNodes = useMemo(() => topology.nodes.filter((node) =>
    [node.name, node.type, node.namespace ?? '', node.status ?? '']
      .some((value) => value.toLowerCase().includes(search.toLowerCase()))), [topology.nodes, search])

  const graph = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((node) => node.id))
    const byLayer = new Map<number, TopologyNode[]>()
    for (const item of visibleNodes) {
      const layer = LAYERS[item.type] ?? 2
      byLayer.set(layer, [...(byLayer.get(layer) ?? []), item])
    }
    const positions = new Map<string, { x: number; y: number }>()
    for (const [layer, items] of byLayer) {
      items.sort((a, b) => (a.namespace ?? '').localeCompare(b.namespace ?? '') || a.name.localeCompare(b.name))
      items.forEach((item, index) => positions.set(item.id, { x: 90 + layer * 330, y: 100 + index * 116 }))
    }
    const nodes: Node[] = visibleNodes.map((item) => ({
      id: item.id,
      type: 'resource',
      position: positions.get(item.id) ?? { x: 0, y: 0 },
      data: { resource: item },
      selected: selected?.id === item.id,
    }))
    const edges: Edge[] = topology.edges
      .filter((edge) => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId))
      .map((edge, index) => ({
        id: `${edge.sourceId}-${edge.relation}-${edge.targetId}-${index}`,
        source: edge.sourceId,
        target: edge.targetId,
        type: 'smoothstep',
        label: edge.relation === 'ROUTES_TO' ? 'routes to' : undefined,
        animated: edge.relation === 'ROUTES_TO',
        style: { stroke: edge.relation === 'ROUTES_TO' ? '#a78bfa' : '#476176', strokeWidth: edge.relation === 'ROUTES_TO' ? 1.8 : 1.15, opacity: edge.relation === 'ROUTES_TO' ? 0.9 : 0.48 },
        labelStyle: { fill: '#c4b5fd', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#0b1220', fillOpacity: 0.96 },
        pathOptions: { borderRadius: 18 },
      }))
    return { nodes, edges }
  }, [visibleNodes, topology.edges, selected])

  const counts = useMemo(() => topology.nodes.reduce<Record<string, number>>((result, item) => {
    result[item.type] = (result[item.type] ?? 0) + 1
    return result
  }, {}), [topology.nodes])

  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Observe / Architecture</p><h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">Cluster topology</h1><p className="mt-2 text-sm text-slate-400">Explore discovered Kubernetes resources and their actual relationships.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh</button>
    </section>

    <RequestState loading={loading && topology.nodes.length === 0} error={error && topology.nodes.length === 0 ? error : null} onRetry={() => void load()}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1523] px-3 py-2 text-xs text-slate-400">Namespace
          <select value={namespace} onChange={(event) => setNamespace(event.target.value)} className="max-w-44 bg-transparent text-slate-200 outline-none"><option value="">All namespaces</option>{namespaces.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <label className="relative min-w-48 flex-1 sm:max-w-xs"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a resource..." className="w-full rounded-lg border border-white/10 bg-[#0d1523] py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"/></label>
        <span className="text-[10px] text-slate-500">{visibleNodes.length} resources · {graph.edges.length} relationships</span>
      </div>

      <div className="flex flex-wrap gap-2">{Object.entries(counts).map(([type, count]) => <span key={type} className="rounded-md border border-white/[0.07] bg-[#0d1523] px-2.5 py-1.5 text-[10px] text-slate-400">{type} <strong className="ml-1 text-slate-200">{count}</strong></span>)}</div>

      {error && <p role="status" className="text-xs text-amber-300">Refresh failed: {error}. Showing the last successful topology.</p>}
      {topology.nodes.length === 0 ? <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] px-5 py-16 text-center"><GitBranch size={25} className="mx-auto text-cyan-200"/><p className="mt-3 text-sm font-medium text-slate-200">No topology resources discovered</p><p className="mt-1 text-xs text-slate-500">The API returned an empty topology for this cluster.</p></div> :
        <div className="relative h-[760px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#080f1b]">
          <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-32px)] rounded-lg border border-white/[0.08] bg-[#0d1523]/95 px-3 py-2 text-[10px] text-slate-400 shadow-lg">Drag nodes · Scroll to zoom · Use fit view to frame the full graph</div>
          <ReactFlow nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.22, minZoom: 0.12, maxZoom: 0.9 }} minZoom={0.12} maxZoom={1.8} nodesConnectable={false} onNodeClick={(_, node) => setSelected(node.data.resource as TopologyNode)} onPaneClick={() => setSelected(null)} proOptions={{ hideAttribution: true }}>
            <Background color="#26364a" gap={24} size={1}/>
            <Controls className="!overflow-hidden !rounded-lg !border-white/10 !bg-[#101a2a] [&>button]:!border-white/10 [&>button]:!bg-[#101a2a] [&>button]:!fill-slate-300"/>
            <MiniMap pannable zoomable nodeColor={(node) => {
              const resource = node.data.resource as TopologyNode
              return resource.type === 'Pod' ? '#34d399' : resource.type === 'Service' ? '#67e8f9' : resource.type === 'Ingress' ? '#a78bfa' : '#64748b'
            }} maskColor="rgba(2,6,23,0.65)" className="!border-white/10 !bg-[#0d1523]"/>
          </ReactFlow>
          {selected && <aside className="absolute right-3 top-3 z-20 w-[min(300px,calc(100%-24px))] rounded-xl border border-white/10 bg-[#101a2a] p-4 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-cyan-300">{selected.type}</p><h3 className="mt-1 break-all text-sm font-semibold text-white">{selected.name}</h3></div><button onClick={() => setSelected(null)} aria-label="Close details" className="text-slate-400 hover:text-white"><X size={16}/></button></div><dl className="mt-4 space-y-3 text-xs"><div><dt className="text-slate-500">Namespace</dt><dd className="mt-1 text-slate-200">{selected.namespace ?? 'Cluster scoped'}</dd></div><div><dt className="text-slate-500">Status / details</dt><dd className="mt-1 break-words text-slate-200">{selected.status ?? 'Not reported'}</dd></div><div><dt className="text-slate-500">Resource ID</dt><dd className="mt-1 break-all font-mono text-[10px] text-slate-400">{selected.id}</dd></div></dl></aside>}
        </div>
      }
    </RequestState>
  </div>
}
