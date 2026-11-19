import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background, Controls, MiniMap, ReactFlow, Handle, Position,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Box, Container, Database, GitBranch, Layers3,
  Network, RefreshCw, Router, Search, Server, Workflow, X,
  type LucideIcon,
} from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { clusterApi } from '../services/api'
import type { ClusterTopology, TopologyNode } from '../types/cluster'

// ── Chip node (compact horizontal) ────────────────────────────────────────
const CHIP_W       = 186    // chip node width
const CHIP_H       = 36     // chip node height
const CHIP_ICON_D  = 22     // icon circle diameter inside chip
const CHIP_GAP_Y   = 12     // increased vertical gap between chips
const CHIP_COL_GAP = 20     // increased gap between columns inside a zone

// ── Pod icon node (compact circle stacked) ────────────────────────────────
const POD_D        = 32     // pod circle diameter
const POD_W        = 48     // pod node total width
const POD_H        = 48     // pod node total height
const POD_GAP_X    = 12     // increased pod horizontal gap
const POD_GAP_Y    = 10     // increased pod vertical gap
const MAX_POD_COLS = 5

// ── Worker node box ───────────────────────────────────────────────────────
const NODE_PAD_X   = 16
const NODE_PAD_Y   = 12
const NODE_HDR_H   = 42
const NODE_COL_GAP = 24
const NODE_ROW_GAP = 20
const NODES_PER_ROW = 3

// ── Zone & canvas ─────────────────────────────────────────────────────────
const ZONE_PAD_X   = 22
const ZONE_PAD_TOP = 50
const ZONE_PAD_BOT = 22
const ZONE_GAP     = 72     // generous space between zones for clear routing
const OUTER_PAD    = 32

/** Returns the number of chip columns to use for a given item count */
function colCount(n: number): number {
  if (n <= 7)  return 1
  if (n <= 16) return 2
  return 3
}

// ── Icons ─────────────────────────────────────────────────────────────────
const ICON: Record<string, LucideIcon> = {
  Ingress: Router, Service: Network, Deployment: Workflow,
  StatefulSet: Database, EndpointSlice: GitBranch, Pod: Container, Node: Server,
}
const ABBR: Record<string, string> = {
  Ingress: 'ING', Service: 'SVC', Deployment: 'DEP',
  StatefulSet: 'STS', EndpointSlice: 'EPS', Pod: 'POD', Node: 'NODE',
}

// ── Colors ────────────────────────────────────────────────────────────────
type Colors = { accent: string; bg: string; border: string; label: string }
const COLOR: Record<string, Colors> = {
  Ingress:       { accent: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)', label: '#c4b5fd' },
  Service:       { accent: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.30)',  label: '#67e8f9' },
  Deployment:    { accent: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.30)',  label: '#93c5fd' },
  StatefulSet:   { accent: '#818cf8', bg: 'rgba(129,140,248,0.10)', border: 'rgba(129,140,248,0.30)', label: '#a5b4fc' },
  EndpointSlice: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.30)',  label: '#fcd34d' },
  Pod:           { accent: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.30)',  label: '#6ee7b7' },
  Node:          { accent: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.30)', label: '#cbd5e1' },
}

// ── Edge styles ───────────────────────────────────────────────────────────
const EDGE_CFG: Record<string, { stroke: string; dash?: string; animated?: boolean }> = {
  ROUTES_TO:          { stroke: '#a78bfa', animated: true },
  SELECTS:            { stroke: '#60a5fa' },
  OWNS:               { stroke: '#818cf8' },
  HAS_ENDPOINT_SLICE: { stroke: '#f59e0b' },
  HAS_ENDPOINT:       { stroke: '#f59e0b', dash: '4,4' },
}

function healthOf(s: string | null | undefined): 'healthy' | 'warning' | 'critical' {
  const v = (s ?? '').toLowerCase()
  if (/failed|error|crash|notready|unhealthy/.test(v)) return 'critical'
  if (/running|ready|succeeded|active|bound/.test(v))  return 'healthy'
  return 'warning'
}

// ── Node components ───────────────────────────────────────────────────────

type ZoneData = {
  title: string; subtitle: string
  accentColor: string; borderColor: string; bgColor: string
}
function ZoneNode({ data }: NodeProps) {
  const d = data as unknown as ZoneData
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: 14,
      border: `1.5px dashed ${d.borderColor}`,
      background: d.bgColor,
      pointerEvents: 'none',
    }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: `1px solid ${d.borderColor}`,
      }}>
        <div style={{
          color: d.accentColor, fontWeight: 700, fontSize: 10.5,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          {d.title}
        </div>
        <div style={{ color: '#475569', fontSize: 9, marginTop: 2 }}>{d.subtitle}</div>
      </div>
    </div>
  )
}

type CardData = {
  resource: TopologyNode
  isHighlighted?: boolean
  isDimmed?: boolean
}
type NodeFrameData = {
  resource: TopologyNode
  isHighlighted?: boolean
  isDimmed?: boolean
}

/**
 * Compact horizontal chip node.
 * [accent bar] [●icon] TYPE  name ……  ● status
 */
function ChipNode({ data, selected }: NodeProps) {
  const { resource, isHighlighted, isDimmed } = data as unknown as CardData
  const c    = COLOR[resource.type] ?? COLOR.Node
  const Icon = ICON[resource.type]  ?? Box
  const h    = healthOf(resource.status)
  const dot  = h === 'healthy' ? '#34d399' : h === 'critical' ? '#f87171' : '#fbbf24'

  return (
    <div style={{
      width: CHIP_W, height: CHIP_H,
      display: 'flex', alignItems: 'center', gap: 8,
      background: selected
        ? `${c.accent}22`
        : isHighlighted
          ? `${c.accent}14`
          : '#080f1c',
      border: `1.5px solid ${
        selected
          ? c.accent
          : isHighlighted
            ? c.accent
            : c.border
      }`,
      borderRadius: 8,
      padding: '0 8px 0 10px',
      cursor: 'pointer', userSelect: 'none',
      opacity: isDimmed ? 0.28 : 1,
      boxShadow: selected
        ? `0 0 0 2px ${c.accent}40, 0 0 16px ${c.accent}30`
        : isHighlighted
          ? `0 0 0 1.5px ${c.accent}35, 0 0 12px ${c.accent}25`
          : '0 1px 5px rgba(0,0,0,0.4)',
      transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s, background 0.2s',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 5, bottom: 5,
        width: 2.5, background: c.accent, borderRadius: '0 2px 2px 0',
      }} />

      <Handle type="target" position={Position.Left}
        style={{ background: c.accent, border: 'none', width: 6, height: 6, left: -4, top: '50%' }} />

      {/* Circle icon */}
      <div style={{
        width: CHIP_ICON_D, height: CHIP_ICON_D, borderRadius: '50%',
        background: c.bg, border: `1.5px solid ${c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: c.accent,
      }}>
        <Icon size={11} strokeWidth={1.6} />
      </div>

      {/* Labels */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: c.label, fontSize: 7, fontWeight: 800,
          letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
        }}>
          {ABBR[resource.type] ?? resource.type}
        </div>
        <div title={resource.name} style={{
          color: selected || isHighlighted ? '#ffffff' : '#d1dae6',
          fontSize: 9.5, fontWeight: selected || isHighlighted ? 700 : 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginTop: 2, lineHeight: 1,
        }}>
          {resource.name}
        </div>
      </div>

      {/* Status dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dot, border: '1.5px solid #060c17',
        flexShrink: 0,
      }} />

      <Handle type="source" position={Position.Right}
        style={{ background: c.accent, border: 'none', width: 6, height: 6, right: -4, top: '50%' }} />
    </div>
  )
}

/** Worker node dashed-border box that contains pod icon children */
function NodeFrameNode({ data, selected }: NodeProps) {
  const { resource, isHighlighted, isDimmed } = data as unknown as NodeFrameData
  const h    = healthOf(resource.status)
  const dot  = h === 'healthy' ? '#34d399' : h === 'critical' ? '#f87171' : '#fbbf24'
  const lbl  = h === 'healthy' ? 'Ready' : h === 'critical' ? 'NotReady' : (resource.status ?? 'Unknown')

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'rgba(8, 15, 28, 0.94)',
      border: `1.5px solid ${
        selected
          ? 'rgba(148,163,184,0.7)'
          : isHighlighted
            ? 'rgba(148,163,184,0.5)'
            : 'rgba(148,163,184,0.16)'
      }`,
      borderRadius: 12, overflow: 'hidden',
      opacity: isDimmed ? 0.35 : 1,
      boxShadow: selected
        ? '0 0 0 2px rgba(148,163,184,0.25), 0 0 16px rgba(148,163,184,0.15)'
        : isHighlighted
          ? '0 0 0 1.5px rgba(148,163,184,0.2)'
          : 'none',
      cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
    }}>
      {/* Header */}
      <div style={{
        height: NODE_HDR_H, padding: '0 12px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid rgba(148,163,184,0.09)',
        background: 'rgba(148,163,184,0.04)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'rgba(148,163,184,0.08)',
          border: '1px solid rgba(148,163,184,0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Server size={11} style={{ color: '#94a3b8' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#3a5068', fontSize: 7, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Worker Node
          </div>
          <div title={resource.name} style={{
            color: '#cbd5e1', fontSize: 10, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {resource.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot, display: 'inline-block' }} />
          <span style={{ color: '#3a5068', fontSize: 7.5 }}>{lbl}</span>
        </div>
      </div>

      <Handle type="target" position={Position.Left}
        style={{ background: '#94a3b8', border: 'none', width: 6, height: 6, top: NODE_HDR_H / 2 }} />
      <Handle type="source" position={Position.Right}
        style={{ background: '#94a3b8', border: 'none', width: 6, height: 6, top: NODE_HDR_H / 2 }} />
    </div>
  )
}

/** Small pod circle — rendered as parentId child of NodeFrameNode */
function PodIconNode({ data, selected }: NodeProps) {
  const { resource, isHighlighted, isDimmed } = data as unknown as CardData
  const h      = healthOf(resource.status)
  const accent = h === 'healthy' ? '#34d399' : h === 'critical' ? '#f87171' : '#fbbf24'
  const bg     = h === 'healthy' ? 'rgba(52,211,153,0.12)'
    : h === 'critical' ? 'rgba(248,113,113,0.12)'
    : 'rgba(251,191,36,0.12)'

  const short  = resource.name.split('-').slice(-1)[0]?.slice(0, 7) ?? resource.name.slice(0, 7)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: POD_W, cursor: 'pointer', userSelect: 'none',
      opacity: isDimmed ? 0.28 : 1,
      transition: 'opacity 0.2s',
    }}>
      <Handle type="target" position={Position.Left}
        style={{ background: accent, border: 'none', width: 5, height: 5, top: POD_D / 2 }} />

      <div style={{
        width: POD_D, height: POD_D, borderRadius: '50%',
        background: bg,
        border: `1.5px solid ${
          selected
            ? accent
            : isHighlighted
              ? accent
              : accent + '50'
        }`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: selected
          ? `0 0 0 2.5px ${accent}45, 0 0 12px ${accent}40`
          : isHighlighted
            ? `0 0 0 2px ${accent}35, 0 0 10px ${accent}25`
            : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        <Container size={13} style={{ color: accent }} strokeWidth={1.6} />
      </div>

      <div title={resource.name} style={{
        color: selected || isHighlighted ? '#cbd5e1' : '#45596e',
        fontSize: 7.5, fontWeight: selected || isHighlighted ? 600 : 400,
        marginTop: 3, textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        width: POD_W,
      }}>
        {short}
      </div>

      <Handle type="source" position={Position.Right}
        style={{ background: accent, border: 'none', width: 5, height: 5, top: POD_D / 2 }} />
    </div>
  )
}

const nodeTypes = {
  zone:      ZoneNode,
  chipNode:  ChipNode,
  nodeFrame: NodeFrameNode,
  podIcon:   PodIconNode,
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function TopologyPage() {
  const [topology, setTopology]          = useState<ClusterTopology>({ nodes: [], edges: [] })
  const [loading, setLoading]            = useState(true)
  const [error, setError]                = useState<string | null>(null)
  const [namespace, setNamespace]        = useState('')
  const [namespaceOptions, setNsOptions] = useState<string[]>([])
  const [selected, setSelected]          = useState<TopologyNode | null>(null)
  const [search, setSearch]              = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null)
    try {
      const result = await clusterApi.getTopology(namespace || undefined, signal)
      setTopology(result)
      if (!namespace) {
        const nss = [
          ...new Set(result.nodes.map(n => n.namespace).filter((v): v is string => Boolean(v))),
        ].sort()
        setNsOptions(nss)
      }
      setSelected(null)
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unable to load cluster topology')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [namespace])

  useEffect(() => {
    const ctrl = new AbortController()
    void load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const visibleNodes = useMemo(
    () => topology.nodes.filter(n =>
      [n.name, n.type, n.namespace ?? '', n.status ?? '']
        .some(v => v.toLowerCase().includes(search.toLowerCase()))
    ),
    [topology.nodes, search],
  )

  // ── Build React Flow graph ──────────────────────────────────────────────
  const graph = useMemo(() => {
    if (visibleNodes.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] }

    // Connected node IDs when a resource is selected
    const connectedNodeIds = new Set<string>()
    if (selected) {
      connectedNodeIds.add(selected.id)
      for (const e of topology.edges) {
        if (e.sourceId === selected.id) connectedNodeIds.add(e.targetId)
        if (e.targetId === selected.id) connectedNodeIds.add(e.sourceId)
      }
    }

    const byType: Record<string, TopologyNode[]> = {}
    for (const n of visibleNodes) (byType[n.type] ??= []).push(n)

    const sort = (arr: TopologyNode[]) =>
      [...arr].sort((a, b) =>
        `${a.namespace ?? ''}/${a.name}`.localeCompare(`${b.namespace ?? ''}/${b.name}`))

    const ingresses      = sort(byType['Ingress']       ?? [])
    const services       = sort(byType['Service']       ?? [])
    const deployments    = sort(byType['Deployment']    ?? [])
    const statefulSets   = sort(byType['StatefulSet']   ?? [])
    const endpointSlices = sort(byType['EndpointSlice'] ?? [])
    const pods           = byType['Pod'] ?? []
    const k8sNodes       = sort(byType['Node'] ?? [])

    // ── Map pods → worker nodes via SCHEDULED_ON ────────────────────────
    const podToNodeId = new Map<string, string>()
    for (const e of topology.edges)
      if (e.relation === 'SCHEDULED_ON') podToNodeId.set(e.sourceId, e.targetId)

    const nodePodMap  = new Map<string, TopologyNode[]>()
    const unscheduled: TopologyNode[] = []
    const k8sNodeSet  = new Set(k8sNodes.map(n => n.id))

    for (const pod of pods) {
      const nid = podToNodeId.get(pod.id)
      if (nid && k8sNodeSet.has(nid)) {
        if (!nodePodMap.has(nid)) nodePodMap.set(nid, [])
        nodePodMap.get(nid)!.push(pod)
      } else {
        unscheduled.push(pod)
      }
    }
    for (const [, ps] of nodePodMap)
      ps.sort((a, b) =>
        `${a.namespace ?? ''}/${a.name}`.localeCompare(`${b.namespace ?? ''}/${b.name}`))

    // ── Zone sizing helpers ─────────────────────────────────────────────
    const chipZoneDims = (items: TopologyNode[]) => {
      const nCols      = colCount(items.length)
      const perCol     = Math.ceil(Math.max(items.length, 1) / nCols)
      const zoneW      = ZONE_PAD_X * 2 + nCols * CHIP_W + (nCols - 1) * CHIP_COL_GAP
      const zoneH      = ZONE_PAD_TOP + perCol * (CHIP_H + CHIP_GAP_Y) - CHIP_GAP_Y + ZONE_PAD_BOT
      return { nCols, perCol, zoneW, zoneH }
    }

    const chipPos = (idx: number, perCol: number, zoneX: number, zoneY: number) => {
      const c = Math.floor(idx / perCol)
      const r = idx % perCol
      return {
        x: zoneX + ZONE_PAD_X + c * (CHIP_W + CHIP_COL_GAP),
        y: zoneY + ZONE_PAD_TOP + r * (CHIP_H + CHIP_GAP_Y),
      }
    }

    // ── Worker node box dimensions ──────────────────────────────────────
    type Dims = { w: number; h: number }
    const getNodeDims = (nPods: number): Dims => {
      if (nPods === 0) return { w: NODE_PAD_X * 2 + 100, h: NODE_HDR_H + NODE_PAD_Y * 2 + 24 }
      const pc     = Math.min(nPods, MAX_POD_COLS)
      const pr     = Math.ceil(nPods / MAX_POD_COLS)
      const innerW = pc * POD_W + (pc - 1) * POD_GAP_X
      const innerH = pr * POD_H + (pr - 1) * POD_GAP_Y
      return {
        w: Math.max(innerW + NODE_PAD_X * 2, 190),
        h: NODE_HDR_H + NODE_PAD_Y + innerH + NODE_PAD_Y,
      }
    }

    const allNodeIds: string[] = [
      ...k8sNodes.map(n => n.id),
      ...(unscheduled.length > 0 ? ['__unscheduled__'] : []),
    ]
    const dimOf: Record<string, Dims> = {}
    for (const n of k8sNodes)
      dimOf[n.id] = getNodeDims(nodePodMap.get(n.id)?.length ?? 0)
    if (unscheduled.length > 0)
      dimOf['__unscheduled__'] = getNodeDims(unscheduled.length)

    // Worker nodes in a horizontal grid (up to NODES_PER_ROW per row)
    const nodesPerRow = Math.min(Math.max(allNodeIds.length, 1), NODES_PER_ROW)
    const nodeGrid: string[][] = []
    for (let i = 0; i < allNodeIds.length; i += nodesPerRow)
      nodeGrid.push(allNodeIds.slice(i, i + nodesPerRow))

    const rowHeights = nodeGrid.map(row =>
      row.length > 0 ? Math.max(...row.map(id => dimOf[id].h)) : 0)
    const rowWidths  = nodeGrid.map(row =>
      row.reduce((s, id) => s + dimOf[id].w, 0) + Math.max(row.length - 1, 0) * NODE_COL_GAP)

    const compInnerW = Math.max(...rowWidths, 190)
    const compInnerH = rowHeights.reduce((s, h) => s + h, 0)
      + Math.max(nodeGrid.length - 1, 0) * NODE_ROW_GAP
    const compZoneW  = ZONE_PAD_X * 2 + compInnerW
    const compZoneH  = ZONE_PAD_TOP + compInnerH + ZONE_PAD_BOT

    // ── Networking & Workloads zone sizing ──────────────────────────────
    const netItems = [...ingresses, ...services]
    const wlItems  = [...deployments, ...statefulSets, ...endpointSlices]

    const netDims = chipZoneDims(netItems)
    const wlDims  = chipZoneDims(wlItems)

    // ── Overall positions ───────────────────────────────────────────────
    const zonesY = OUTER_PAD + 50
    const maxH   = Math.max(netDims.zoneH, wlDims.zoneH, compZoneH, 240)
    const netX   = OUTER_PAD
    const wlX    = netX + netDims.zoneW + ZONE_GAP
    const compX  = wlX + wlDims.zoneW + ZONE_GAP
    const outerW = compX + compZoneW + OUTER_PAD
    const outerH = zonesY + maxH + OUTER_PAD

    const rfNodes: Node[] = []

    // ── Outer cluster frame ─────────────────────────────────────────────
    rfNodes.push({
      id: '__cluster__', type: 'zone',
      position: { x: 0, y: 0 },
      data: {
        title: 'Kubernetes Cluster',
        subtitle: 'Live resources from connected cluster',
        accentColor: '#22d3ee',
        borderColor: 'rgba(34,211,238,0.14)',
        bgColor: 'rgba(4,9,20,0.98)',
      } as ZoneData,
      style: { width: outerW, height: outerH },
      draggable: false, selectable: false, zIndex: -3,
    })

    // ── Networking zone ─────────────────────────────────────────────────
    rfNodes.push({
      id: '__zone_net__', type: 'zone',
      position: { x: netX, y: zonesY },
      data: {
        title: 'Networking',
        subtitle: 'Ingress & Services',
        accentColor: '#a78bfa',
        borderColor: 'rgba(167,139,250,0.2)',
        bgColor: 'rgba(167,139,250,0.025)',
      } as ZoneData,
      style: { width: netDims.zoneW, height: maxH },
      draggable: false, selectable: false, zIndex: -2,
    })
    netItems.forEach((item, idx) =>
      rfNodes.push({
        id: item.id, type: 'chipNode',
        position: chipPos(idx, netDims.perCol, netX, zonesY),
        data: {
          resource: item,
          isHighlighted: Boolean(selected && connectedNodeIds.has(item.id)),
          isDimmed: Boolean(selected && !connectedNodeIds.has(item.id)),
        } as CardData,
        selected: selected?.id === item.id,
        zIndex: selected?.id === item.id || connectedNodeIds.has(item.id) ? 10 : 1,
      }),
    )

    // ── Workloads zone ──────────────────────────────────────────────────
    rfNodes.push({
      id: '__zone_wl__', type: 'zone',
      position: { x: wlX, y: zonesY },
      data: {
        title: 'Workloads',
        subtitle: 'Deployments, StatefulSets & EndpointSlices',
        accentColor: '#60a5fa',
        borderColor: 'rgba(96,165,250,0.2)',
        bgColor: 'rgba(96,165,250,0.025)',
      } as ZoneData,
      style: { width: wlDims.zoneW, height: maxH },
      draggable: false, selectable: false, zIndex: -2,
    })
    wlItems.forEach((item, idx) =>
      rfNodes.push({
        id: item.id, type: 'chipNode',
        position: chipPos(idx, wlDims.perCol, wlX, zonesY),
        data: {
          resource: item,
          isHighlighted: Boolean(selected && connectedNodeIds.has(item.id)),
          isDimmed: Boolean(selected && !connectedNodeIds.has(item.id)),
        } as CardData,
        selected: selected?.id === item.id,
        zIndex: selected?.id === item.id || connectedNodeIds.has(item.id) ? 10 : 1,
      }),
    )

    // ── Compute zone ────────────────────────────────────────────────────
    rfNodes.push({
      id: '__zone_comp__', type: 'zone',
      position: { x: compX, y: zonesY },
      data: {
        title: 'Compute',
        subtitle: 'Worker nodes & scheduled pods',
        accentColor: '#94a3b8',
        borderColor: 'rgba(148,163,184,0.2)',
        bgColor: 'rgba(148,163,184,0.025)',
      } as ZoneData,
      style: { width: compZoneW, height: maxH },
      draggable: false, selectable: false, zIndex: -2,
    })

    // Worker nodes arranged side-by-side (horizontal grid)
    let rowY = zonesY + ZONE_PAD_TOP
    for (let rowIdx = 0; rowIdx < nodeGrid.length; rowIdx++) {
      const row = nodeGrid[rowIdx]
      let colX  = compX + ZONE_PAD_X

      for (const nodeId of row) {
        const dim           = dimOf[nodeId]
        const isUnscheduled = nodeId === '__unscheduled__'
        const resource      = isUnscheduled
          ? { id: '__unscheduled__', type: 'Node', name: 'Unscheduled / Pending', namespace: null, status: 'warning' } as TopologyNode
          : k8sNodes.find(n => n.id === nodeId)!

        rfNodes.push({
          id: nodeId, type: 'nodeFrame',
          position: { x: colX, y: rowY },
          data: {
            resource,
            isHighlighted: Boolean(selected && connectedNodeIds.has(nodeId)),
            isDimmed: Boolean(selected && !connectedNodeIds.has(nodeId)),
          } as NodeFrameData,
          style: { width: dim.w, height: dim.h },
          selected: selected?.id === nodeId,
          draggable: false, selectable: !isUnscheduled, zIndex: 0,
        })

        // Pod icons as parentId children
        const podList = isUnscheduled ? unscheduled : (nodePodMap.get(nodeId) ?? [])
        podList.forEach((pod, pIdx) => {
          const pc  = pIdx % MAX_POD_COLS
          const pr  = Math.floor(pIdx / MAX_POD_COLS)
          rfNodes.push({
            id: pod.id, type: 'podIcon',
            position: {
              x: NODE_PAD_X + pc * (POD_W + POD_GAP_X),
              y: NODE_HDR_H + NODE_PAD_Y + pr * (POD_H + POD_GAP_Y),
            },
            parentId: nodeId,
            extent: 'parent' as const,
            data: {
              resource: pod,
              isHighlighted: Boolean(selected && connectedNodeIds.has(pod.id)),
              isDimmed: Boolean(selected && !connectedNodeIds.has(pod.id)),
            } as CardData,
            selected: selected?.id === pod.id,
            draggable: false, selectable: true,
            zIndex: selected?.id === pod.id || connectedNodeIds.has(pod.id) ? 10 : 2,
          })
        })

        colX += dim.w + NODE_COL_GAP
      }

      rowY += rowHeights[rowIdx] + NODE_ROW_GAP
    }

    // ── Edges: subtle / ghosted by default, glowing when connected to selected ──
    const visibleIds = new Set(visibleNodes.map(n => n.id))
    const rfEdges: Edge[] = topology.edges
      .filter(e => e.relation !== 'SCHEDULED_ON')
      .filter(e => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId))
      .map((e, idx) => {
        const isConnected = Boolean(selected && (e.sourceId === selected.id || e.targetId === selected.id))
        const hasSelection = Boolean(selected)
        const cfg = EDGE_CFG[e.relation] ?? { stroke: '#38bdf8' }

        return {
          id: `e${idx}-${e.sourceId}-${e.targetId}`,
          source: e.sourceId,
          target: e.targetId,
          type: 'smoothstep',
          animated: isConnected ? true : (hasSelection ? false : (cfg.animated ?? false)),
          zIndex: isConnected ? 20 : 0,
          style: isConnected
            ? {
                stroke: cfg.stroke,
                strokeWidth: 2.5,
                strokeDasharray: cfg.dash,
                opacity: 1,
                filter: `drop-shadow(0 0 6px ${cfg.stroke})`,
                transition: 'stroke-width 0.2s, opacity 0.2s, filter 0.2s',
              }
            : hasSelection
              ? {
                  stroke: 'rgba(255, 255, 255, 0.04)',
                  strokeWidth: 1,
                  opacity: 0.1,
                  transition: 'stroke-width 0.2s, opacity 0.2s',
                }
              : {
                  // Default clean light appearance
                  stroke: 'rgba(148, 163, 184, 0.18)',
                  strokeWidth: 1.2,
                  strokeDasharray: cfg.dash,
                  opacity: 0.35,
                  transition: 'stroke-width 0.2s, opacity 0.2s',
                },
          pathOptions: { borderRadius: 10 },
        }
      })

    return { nodes: rfNodes, edges: rfEdges }
  }, [visibleNodes, topology.edges, selected])

  // ── Derived data ────────────────────────────────────────────────────────
  const counts = useMemo(
    () => topology.nodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.type] = (acc[n.type] ?? 0) + 1; return acc
    }, {}),
    [topology.nodes],
  )

  const selectedLinks = useMemo(
    () => selected
      ? topology.edges.filter(e => e.sourceId === selected.id || e.targetId === selected.id)
      : [],
    [selected, topology.edges],
  )

  const relatedResources = useMemo(
    () => selectedLinks.map(e => {
      const otherId  = e.sourceId === selected?.id ? e.targetId : e.sourceId
      const resource = topology.nodes.find(n => n.id === otherId)
      return resource
        ? { resource, relation: e.relation, direction: e.sourceId === selected?.id ? 'Outgoing' : 'Incoming' }
        : null
    }).filter((x): x is NonNullable<typeof x> => x !== null),
    [selectedLinks, selected, topology.nodes],
  )

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            Observe / Architecture
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
            Cluster Topology
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Visual map of Kubernetes resources — networking, workloads, and compute.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </section>

      <RequestState
        loading={loading && topology.nodes.length === 0}
        error={error && topology.nodes.length === 0 ? error : null}
        onRetry={() => void load()}
      >
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1523] px-3 py-2 text-xs text-slate-400">
            Namespace
            <select
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              className="max-w-44 bg-transparent text-slate-200 outline-none"
            >
              <option value="">All namespaces</option>
              {namespaceOptions.map(ns => <option key={ns} value={ns}>{ns}</option>)}
            </select>
          </label>
          <label className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter resources…"
              className="w-full rounded-lg border border-white/10 bg-[#0d1523] py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </label>
          <span className="text-[10px] text-slate-500">
            {visibleNodes.length} resources · {graph.edges.length} edges
          </span>
        </div>

        {/* Type chips */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([type, count]) => {
            const c    = COLOR[type]
            const Icon = ICON[type] ?? Box
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]"
                style={{
                  borderColor: c?.border ?? 'rgba(255,255,255,0.1)',
                  color:       c?.label  ?? '#94a3b8',
                  background:  c?.bg     ?? 'transparent',
                }}
              >
                <Icon size={10} /> {type} <strong>{count}</strong>
              </span>
            )
          })}
        </div>

        {error && (
          <p role="status" className="text-xs text-amber-300">
            Refresh failed: {error}. Showing last topology.
          </p>
        )}

        {/* Empty state */}
        {topology.nodes.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] px-5 py-16 text-center">
            <GitBranch size={25} className="mx-auto text-cyan-200" />
            <p className="mt-3 text-sm font-medium text-slate-200">No topology data</p>
            <p className="mt-1 text-xs text-slate-500">
              The API returned an empty topology for this cluster.
            </p>
          </div>
        ) : (
          /* Canvas */
          <div className="relative h-[760px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#060c17]">

            {/* Hint */}
            <div className="absolute left-4 top-4 z-10 rounded-lg border border-white/[0.07] bg-[#0d1523]/95 px-3 py-1.5 text-[10px] text-slate-500 shadow-lg backdrop-blur">
              Click a resource to highlight its routes · Scroll to zoom · Drag to pan
            </div>

            {/* Edge legend */}
            <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-white/[0.07] bg-[#0d1523]/95 px-3 py-2.5 shadow-lg backdrop-blur">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                Edge legend
              </div>
              <div className="flex flex-col gap-1.5">
                {([
                  { label: 'Routes to (Ingress → Service)', color: '#a78bfa', animated: true },
                  { label: 'Selects (Service → Pod)',        color: '#60a5fa', animated: false },
                  { label: 'Owns (Controller → Pod)',        color: '#818cf8', animated: false },
                  { label: 'Endpoint slice / endpoint',      color: '#f59e0b', animated: false },
                ]).map(({ label, color, animated }) => (
                  <div key={label} className="flex items-center gap-2">
                    <svg width="28" height="8" style={{ flexShrink: 0 }}>
                      <line x1="0" y1="4" x2="22" y2="4" stroke={color} strokeWidth="1.5"
                        strokeDasharray={animated ? '4,3' : undefined} />
                      <polygon points="18,1 28,4 18,7" fill={color} />
                    </svg>
                    <span className="text-[9px] text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <ReactFlow
              key={`${namespace}-${search}-${graph.nodes.length}`}
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.08, minZoom: 0.04, maxZoom: 1.5 }}
              minZoom={0.03}
              maxZoom={2.5}
              nodesConnectable={false}
              onNodeClick={(_, node) => {
                if (node.type === 'zone') return
                const resource = (node.data as { resource: TopologyNode }).resource
                if (resource && resource.id !== '__unscheduled__') setSelected(resource)
              }}
              onPaneClick={() => setSelected(null)}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#0d1a2d" gap={30} size={1} />
              <Controls className="!overflow-hidden !rounded-lg !border-white/10 !bg-[#101a2a] [&>button]:!border-white/10 [&>button]:!bg-[#101a2a] [&>button]:!fill-slate-300" />
              <MiniMap
                pannable zoomable
                nodeColor={n => {
                  if (n.type === 'zone')      return 'transparent'
                  if (n.type === 'nodeFrame') return '#1a2535'
                  if (n.type === 'podIcon') {
                    const r = (n.data as CardData).resource
                    const h = healthOf(r?.status)
                    return h === 'healthy' ? '#1a3328' : h === 'critical' ? '#3b1a1a' : '#2a2210'
                  }
                  const r = (n.data as CardData).resource
                  return COLOR[r?.type]?.accent ?? '#334155'
                }}
                maskColor="rgba(2,6,23,0.65)"
                className="!border-white/10 !bg-[#0d1523]"
              />
            </ReactFlow>

            {/* Detail panel */}
            {selected && (
              <aside className="absolute right-3 top-3 z-20 max-h-[calc(100%-24px)] w-[min(320px,calc(100%-24px))] overflow-y-auto rounded-xl border border-white/10 bg-[#0d1523]/[0.98] p-4 shadow-2xl backdrop-blur">
                {/* Panel header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {(() => {
                      const c    = COLOR[selected.type]
                      const Icon = ICON[selected.type] ?? Box
                      return (
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: c?.bg, border: `2px solid ${c?.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, color: c?.accent,
                        }}>
                          <Icon size={15} strokeWidth={1.6} />
                        </div>
                      )
                    })()}
                    <div className="min-w-0">
                      <p
                        style={{ color: COLOR[selected.type]?.accent ?? '#22d3ee' }}
                        className="text-[9px] font-bold uppercase tracking-widest"
                      >
                        {selected.type}
                      </p>
                      <h3 className="mt-0.5 break-all text-sm font-semibold text-white leading-tight">
                        {selected.name}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="shrink-0 text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                <dl className="mt-4 space-y-2.5 text-xs">
                  <div>
                    <dt className="text-slate-500">Namespace</dt>
                    <dd className="mt-0.5 text-slate-200">{selected.namespace ?? 'Cluster scoped'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                        background: healthOf(selected.status) === 'healthy' ? '#34d399'
                          : healthOf(selected.status) === 'critical' ? '#f87171' : '#fbbf24',
                      }} />
                      <span className="text-slate-200">{selected.status ?? 'Not reported'}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Resource ID</dt>
                    <dd className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
                      {selected.id}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-white/[0.07] pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-200">Relationships</h4>
                    <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-500">
                      {relatedResources.length}
                    </span>
                  </div>
                  {relatedResources.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No relationships reported.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {relatedResources.map(({ resource, relation, direction }) => {
                        const c    = COLOR[resource.type]
                        const Icon = ICON[resource.type] ?? Box
                        return (
                          <button
                            key={`${resource.id}-${relation}`}
                            type="button"
                            onClick={() => setSelected(resource)}
                            className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.025] p-2 text-left transition hover:bg-white/[0.06]"
                          >
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: c?.bg, border: `1.5px solid ${c?.border}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, color: c?.accent,
                            }}>
                              <Icon size={12} strokeWidth={1.6} />
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-medium text-slate-200">
                                {resource.name}
                              </span>
                              <span className="mt-0.5 block text-[9px] text-slate-500">
                                {direction} · {relation.replaceAll('_', ' ').toLowerCase()}
                              </span>
                            </span>
                            <Layers3 size={11} className="shrink-0 text-slate-700" />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </RequestState>
    </div>
  )
}
