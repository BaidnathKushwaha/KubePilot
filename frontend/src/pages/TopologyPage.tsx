import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background, Controls, MiniMap, ReactFlow, Handle, Position,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Box, CircleHelp, Container, Database, GitBranch, Layers3,
  Network, RefreshCw, Router, Search, Server, Workflow, X,
  type LucideIcon,
} from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { clusterApi } from '../services/api'
import type { ClusterTopology, TopologyNode } from '../types/cluster'

type FrameData = { title: string; subtitle: string; tone: 'cluster' | 'network' | 'workloads' | 'compute' }
type ResourceData = { resource: TopologyNode }
type GraphNode = Node<FrameData | ResourceData>

const GROUPS = [
  { id: 'network', title: 'Networking', subtitle: 'Ingress and service entry points', types: ['Ingress', 'Service'], x: 70, tone: 'network' as const },
  { id: 'workloads', title: 'Workloads', subtitle: 'Controllers and endpoint discovery', types: ['Deployment', 'StatefulSet', 'EndpointSlice'], x: 455, tone: 'workloads' as const },
  { id: 'compute', title: 'Compute', subtitle: 'Pods scheduled onto cluster nodes', types: ['Pod', 'Node'], x: 840, tone: 'compute' as const },
]
const ICONS: Record<string, LucideIcon> = {
  Ingress: Router,
  Service: Network,
  Deployment: Workflow,
  StatefulSet: Database,
  EndpointSlice: GitBranch,
  Pod: Container,
  Node: Server,
}
const TONES: Record<string, string> = {
  Ingress: 'border-violet-300/30 bg-violet-300/[0.08] text-violet-200',
  Service: 'border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-200',
  Deployment: 'border-blue-300/30 bg-blue-300/[0.08] text-blue-200',
  StatefulSet: 'border-indigo-300/30 bg-indigo-300/[0.08] text-indigo-200',
  EndpointSlice: 'border-amber-300/30 bg-amber-300/[0.08] text-amber-200',
  Pod: 'border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-200',
  Node: 'border-slate-300/30 bg-slate-300/[0.08] text-slate-200',
}
const FRAME_TONES: Record<FrameData['tone'], string> = {
  cluster: 'border-cyan-300/25 bg-[#0c1a2a]/95',
  network: 'border-violet-300/20 bg-violet-300/[0.035]',
  workloads: 'border-blue-300/20 bg-blue-300/[0.035]',
  compute: 'border-emerald-300/20 bg-emerald-300/[0.035]',
}

function FrameNode({ data }: NodeProps) {
  const frame = data as unknown as FrameData
  return (
    <div className={`h-full w-full rounded-2xl border ${FRAME_TONES[frame.tone]}`}>
      <div className="border-b border-white/[0.07] px-5 py-4">
        <div className="text-sm font-semibold tracking-wide text-slate-100">{frame.title}</div>
        <div className="mt-1 text-[11px] text-slate-500">{frame.subtitle}</div>
      </div>
    </div>
  )
}

function getHealth(status: string | null): 'healthy' | 'warning' | 'critical' {
  const value = (status ?? '').toLowerCase()
  if (/failed|error|crash|notready|unhealthy/.test(value)) return 'critical'
  if (/running|ready|succeeded|active|bound/.test(value)) return 'healthy'
  return 'warning'
}

function ResourceNode({ data }: NodeProps) {
  const resource = (data as unknown as ResourceData).resource
  const Icon = ICONS[resource.type] ?? Box
  const health = getHealth(resource.status)
  const healthTone = health === 'healthy' ? 'bg-emerald-400' : health === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
  const healthLabel = health === 'healthy' ? 'Healthy' : health === 'critical' ? 'Critical' : 'Check'
  return (
    <div className={`relative flex h-[82px] w-[300px] items-center gap-3 rounded-xl border bg-[#111d2d] px-3.5 shadow-lg shadow-black/20 transition-all hover:border-cyan-200/40 hover:bg-[#15243a] ${TONES[resource.type] ?? 'border-white/10'}`}>
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-cyan-300"/>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-current/10`}>
        <Icon size={21} strokeWidth={1.8}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">{resource.type}</span>
          <span className="truncate text-[9px] text-slate-600">{resource.namespace ?? 'cluster scope'}</span>
        </div>
        <div className="mt-1 truncate text-[12px] font-semibold text-slate-100" title={resource.name}>{resource.name}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${healthTone}`}/>
          <span className="truncate text-[10px] text-slate-400">{resource.status ?? healthLabel}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-cyan-300"/>
    </div>
  )
}

const nodeTypes = { frame: FrameNode, resource: ResourceNode }

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

  const visibleNodes = useMemo(() => topology.nodes.filter((node) =>
    [node.name, node.type, node.namespace ?? '', node.status ?? '']
      .some((value) => value.toLowerCase().includes(search.toLowerCase()))), [topology.nodes, search])

  const graph = useMemo(() => {
    const nodes: GraphNode[] = []
    const positions = new Map<string, { x: number; y: number }>()
    const grouped = GROUPS.map((group) => {
      const items = visibleNodes
        .filter((item) => group.types.includes(item.type))
        .sort((a, b) => group.types.indexOf(a.type) - group.types.indexOf(b.type)
          || (a.namespace ?? '').localeCompare(b.namespace ?? '')
          || a.name.localeCompare(b.name))
      return { ...group, items }
    })
    const maxItems = Math.max(1, ...grouped.map((group) => group.items.length))
    const sectionHeight = Math.max(390, 104 + maxItems * 106)
    const clusterHeight = sectionHeight + 150

    nodes.push({
      id: 'cluster-frame', type: 'frame', position: { x: 0, y: 0 },
      data: { title: 'Kubernetes cluster', subtitle: 'Live resources discovered from the connected cluster', tone: 'cluster' },
      style: { width: 1230, height: clusterHeight }, draggable: false, selectable: false, zIndex: -2,
    })

    grouped.forEach((group) => {
      nodes.push({
        id: `frame-${group.id}`, type: 'frame', position: { x: group.x, y: 105 },
        data: { title: group.title, subtitle: group.subtitle, tone: group.tone },
        style: { width: 350, height: sectionHeight }, draggable: false, selectable: false, zIndex: -1,
      })
      group.items.forEach((item, index) => {
        positions.set(item.id, { x: group.x + 25, y: 174 + index * 106 })
        nodes.push({
          id: item.id, type: 'resource',
          position: positions.get(item.id)!,
          data: { resource: item },
          selected: selected?.id === item.id,
          draggable: true,
        })
      })
    })

    const visibleIds = new Set(visibleNodes.map((node) => node.id))
    const edges: Edge[] = topology.edges
      .filter((edge) => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId))
      .map((edge, index) => ({
        id: `${edge.sourceId}-${edge.relation}-${edge.targetId}-${index}`,
        source: edge.sourceId,
        target: edge.targetId,
        type: 'smoothstep',
        animated: edge.relation === 'ROUTES_TO',
        style: {
          stroke: edge.relation === 'ROUTES_TO' ? '#a78bfa' : '#55738d',
          strokeWidth: edge.relation === 'ROUTES_TO' ? 2.2 : 1.5,
          opacity: edge.relation === 'ROUTES_TO' ? 0.95 : 0.62,
        },
        pathOptions: { borderRadius: 14 },
      }))
    return { nodes, edges, sectionHeight }
  }, [visibleNodes, topology.edges, selected])

  const counts = useMemo(() => topology.nodes.reduce<Record<string, number>>((result, item) => {
    result[item.type] = (result[item.type] ?? 0) + 1
    return result
  }, {}), [topology.nodes])

  const selectedLinks = useMemo(() => selected ? topology.edges.filter(
    (edge) => edge.sourceId === selected.id || edge.targetId === selected.id,
  ) : [], [selected, topology.edges])

  const relatedResources = useMemo(() => selectedLinks.map((edge) => {
    const otherId = edge.sourceId === selected?.id ? edge.targetId : edge.sourceId
    const resource = topology.nodes.find((node) => node.id === otherId)
    return resource ? { resource, relation: edge.relation, direction: edge.sourceId === selected?.id ? 'Outgoing' : 'Incoming' } : null
  }).filter((item): item is NonNullable<typeof item> => item !== null), [selectedLinks, selected, topology.nodes])

  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Observe / Architecture</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">Cluster topology</h1>
        <p className="mt-2 text-sm text-slate-400">A visual map of discovered Kubernetes networking, workloads and compute resources.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50">
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>Refresh
      </button>
    </section>

    <RequestState loading={loading && topology.nodes.length === 0} error={error && topology.nodes.length === 0 ? error : null} onRetry={() => void load()}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1523] px-3 py-2 text-xs text-slate-400">Namespace
          <select value={namespace} onChange={(event) => setNamespace(event.target.value)} className="max-w-44 bg-transparent text-slate-200 outline-none">
            <option value="">All namespaces</option>{namespaceOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a resource..." className="w-full rounded-lg border border-white/10 bg-[#0d1523] py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"/>
        </label>
        <span className="text-[10px] text-slate-500">{visibleNodes.length} resources · {graph.edges.length} relationships</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([type, count]) => {
          const Icon = ICONS[type] ?? CircleHelp
          return <span key={type} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-[#0d1523] px-2.5 py-1.5 text-[10px] text-slate-400"><Icon size={12}/>{type}<strong className="ml-1 text-slate-200">{count}</strong></span>
        })}
      </div>

      {error && <p role="status" className="text-xs text-amber-300">Refresh failed: {error}. Showing the last successful topology.</p>}
      {topology.nodes.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] px-5 py-16 text-center">
          <GitBranch size={25} className="mx-auto text-cyan-200"/>
          <p className="mt-3 text-sm font-medium text-slate-200">No topology resources discovered</p>
          <p className="mt-1 text-xs text-slate-500">The API returned an empty topology for this cluster.</p>
        </div>
      ) : (
        <div className="relative h-[760px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#080f1b]">
          <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-32px)] rounded-lg border border-white/[0.08] bg-[#0d1523]/95 px-3 py-2 text-[10px] text-slate-400 shadow-lg">
            Select a resource for details · Drag to rearrange · Scroll to zoom
          </div>
          <ReactFlow
            key={`${namespace}-${search}-${graph.nodes.length}`}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.16, minZoom: 0.12, maxZoom: 0.85 }}
            minZoom={0.08}
            maxZoom={1.8}
            nodesConnectable={false}
            onNodeClick={(_, node) => {
              if (node.type === 'resource') setSelected((node.data as ResourceData).resource)
            }}
            onPaneClick={() => setSelected(null)}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#26364a" gap={24} size={1}/>
            <Controls className="!overflow-hidden !rounded-lg !border-white/10 !bg-[#101a2a] [&>button]:!border-white/10 [&>button]:!bg-[#101a2a] [&>button]:!fill-slate-300"/>
            <MiniMap pannable zoomable nodeColor={(node) => {
              if (node.type === 'frame') return 'transparent'
              const resource = (node.data as ResourceData).resource
              return resource.type === 'Pod' ? '#34d399' : resource.type === 'Service' ? '#67e8f9' : resource.type === 'Ingress' ? '#a78bfa' : '#64748b'
            }} maskColor="rgba(2,6,23,0.65)" className="!border-white/10 !bg-[#0d1523]"/>
          </ReactFlow>

          {selected && (
            <aside className="absolute right-3 top-3 z-20 max-h-[calc(100%-24px)] w-[min(340px,calc(100%-24px))] overflow-y-auto rounded-xl border border-white/10 bg-[#101a2a]/[0.98] p-4 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {(() => { const Icon = ICONS[selected.type] ?? Box; return <div className={`rounded-lg border p-2 ${TONES[selected.type] ?? 'border-white/10 text-slate-200'}`}><Icon size={19}/></div> })()}
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-cyan-300">{selected.type}</p>
                    <h3 className="mt-1 break-all text-sm font-semibold text-white">{selected.name}</h3>
                  </div>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="text-slate-400 hover:text-white"><X size={16}/></button>
              </div>
              <dl className="mt-5 space-y-3 text-xs">
                <div><dt className="text-slate-500">Namespace</dt><dd className="mt-1 text-slate-200">{selected.namespace ?? 'Cluster scoped'}</dd></div>
                <div><dt className="text-slate-500">Status / details</dt><dd className="mt-1 break-words text-slate-200">{selected.status ?? 'Not reported'}</dd></div>
                <div><dt className="text-slate-500">Resource ID</dt><dd className="mt-1 break-all font-mono text-[10px] text-slate-400">{selected.id}</dd></div>
              </dl>
              <div className="mt-5 border-t border-white/[0.08] pt-4">
                <div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-semibold text-slate-200">Relationships</h4><span className="text-[10px] text-slate-500">{relatedResources.length} linked</span></div>
                {relatedResources.length === 0 ? <p className="text-[11px] text-slate-500">No relationships were reported for this resource.</p> : (
                  <div className="space-y-2">
                    {relatedResources.map(({ resource, relation, direction }) => (
                      <button key={`${resource.id}-${relation}`} type="button" onClick={() => setSelected(resource)} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] p-2 text-left hover:bg-white/[0.06]">
                        <Layers3 size={14} className="shrink-0 text-cyan-300"/>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[11px] text-slate-200">{resource.name}</span><span className="mt-0.5 block text-[9px] text-slate-500">{direction} · {relation.replaceAll('_', ' ').toLowerCase()}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </RequestState>
  </div>
}
