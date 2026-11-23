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

export interface QuotaSummary {
  name: string
  hard: Record<string, string>
  used: Record<string, string>
}

export interface NamespaceOverviewItem {
  name: string
  status: string
  createdAt: string | null
  podCount: number
  deploymentCount: number
  serviceCount: number
  resourceQuotas: QuotaSummary[]
}

export interface DaemonSetSummary {
  name: string
  desiredNumberScheduled: number
  currentNumberScheduled: number
  numberReady: number
}

export interface ConfigMapSummary {
  name: string
  dataKeyCount: number
  createdAt: string | null
}

export interface SecretMetadataSummary {
  name: string
  type: string | null
  dataKeyCount: number
  createdAt: string | null
}

export interface LimitRangeSummary {
  name: string
  itemCount: number
}

export interface NamespaceDetailResponse {
  name: string
  status: string
  createdAt: string | null
  labels: Record<string, string>
  pods: KubernetesPod[]
  deployments: Array<{ name: string; namespace: string; desiredReplicas: number; readyReplicas: number; health: string }>
  statefulSets: Array<{ name: string; namespace: string; desiredReplicas: number; readyReplicas: number; health: string }>
  daemonSets: DaemonSetSummary[]
  services: Array<{ name: string; namespace: string; type: string | null; clusterIP: string | null }>
  configMaps: ConfigMapSummary[]
  secretsMetadataOnly: SecretMetadataSummary[]
  resourceQuotas: QuotaSummary[]
  limitRanges: LimitRangeSummary[]
  events: NodeEventInfo[]
}

export interface NodeConditionInfo {
  type: string
  status: string
  reason: string | null
  message: string | null
  lastTransitionTime: string | null
}

export interface NodeTaintInfo {
  key: string
  value: string | null
  effect: string | null
}

export interface KubernetesNode {
  name: string
  status: string
  kubernetesVersion: string
  architecture: string
  capacity: Record<string, string>
  internalIP?: string | null
  operatingSystem?: string | null
  osImage?: string | null
  containerRuntime?: string | null
  unschedulable?: boolean
  podCapacity?: string | null
  allocatable?: Record<string, string>
  conditions?: NodeConditionInfo[]
  taints?: NodeTaintInfo[]
  labels?: Record<string, string>
}

export interface NodeEventInfo {
  reason: string | null
  type: string | null
  message: string | null
  sourceComponent: string | null
  eventTime: string | null
}

export interface NodeDetailResponse {
  node: KubernetesNode
  schedulingStatus: 'SCHEDULABLE' | 'UNSCHEDULABLE' | string
  cpuUsageMilliCores: number | null
  memoryUsageBytes: number | null
  metricsTimestamp: string | null
  scheduledPods: KubernetesPod[]
  events: NodeEventInfo[]
}

export interface NodeOperationResponse {
  operation: 'CORDON' | 'UNCORDON' | string
  nodeName: string
  status: 'ACCEPTED' | 'NO_CHANGE' | string
  schedulingStatus: 'SCHEDULABLE' | 'UNSCHEDULABLE' | string
  message: string
  auditId: string
  timestamp: string
}

export interface OperationAuditRecord {
  id: string
  operation: string
  targetKind: string
  targetName: string
  namespace: string | null
  status: string
  details: string
  outcomeMessage: string
  timestamp: string
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
export interface ClusterEventResponse {
  uid: string | null
  type: string
  reason: string | null
  message: string | null
  count: number
  involvedKind: string | null
  involvedName: string | null
  involvedNamespace: string | null
  sourceComponent: string | null
  timestamp: string | null
}