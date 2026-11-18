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
