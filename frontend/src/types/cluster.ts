export interface ClusterOverview {
  nodesTotal: number
  nodesReady: number
  nodesNotReady: number
  namespacesTotal: number
  podsTotal: number
  podsRunning: number
  podsPending: number
  podsFailed: number
  podsSucceeded: number
  podsReady: number
  podsNotReady: number
  cpuMilliCores: number
  memoryBytes: number
  metricsTimestamp: string | null
}

export interface KubernetesNode {
  name: string
  status: string
  kubernetesVersion: string
  architecture: string
  capacity: Record<string, string>
}

export interface KubernetesPod {
  name: string
  namespace: string
  status: string
  nodeName: string | null
  podIP: string | null
  restarts: number
  createdAt: string | null
  ready: boolean
  labels: Record<string, string>
  ownerKind: string | null
  ownerName: string | null
  ownerUid: string | null
}

export interface NodeMetrics {
  name: string
  cpuMilliCores: number
  memoryBytes: number
  timestamp: string
  window: string
}

export interface PodMetrics {
  name: string
  namespace: string
  cpuMilliCores: number
  memoryBytes: number
  timestamp: string
  window: string
  containers: ContainerMetrics[]
}

export interface ContainerMetrics {
  name: string
  cpuMilliCores: number
  memoryBytes: number
}


export interface TopologyNode {
  id: string
  type: 'Ingress' | 'Service' | 'Deployment' | 'StatefulSet' | 'EndpointSlice' | 'Pod' | 'Node' | string
  name: string
  namespace: string | null
  status: string | null
}

export interface TopologyEdge {
  sourceId: string
  targetId: string
  relation: string
}

export interface ClusterTopology {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export interface NamespaceInfo {
  name: string
  status: string
  createdAt: string | null
}
