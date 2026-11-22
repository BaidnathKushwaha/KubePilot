import type {
  ClusterOverview,
  ClusterTopology,
  KubernetesNode,
  KubernetesPod,
  NodeMetrics,
  PodMetrics,
  NamespaceInfo, NodeDetailResponse, NodeOperationResponse, OperationAuditRecord, NamespaceOverviewItem,
  NamespaceDetailResponse, NodeDrainPrecheckResponse, NodeDrainResponse,
} from '../types/cluster'
import type { PodInspection } from '../types/podInspection'
import type {
  DeploymentInfo,
  RolloutHistoryResponse,
  RolloutStatusResponse,
  StatefulSetInfo,
  WorkloadOperationResponse,
} from '../types/workload'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function requestText(path: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: { Accept: 'text/plain' },
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Request failed with status ${response.status}`)
  }

  return response.text()
}

export interface DeploymentOperationResponse {
  operation: string
  name: string
  namespace: string
  status: string
  message: string
  desiredReplicas: number | null
  timestamp: string
}

export const clusterApi = {
  getPodLogs: (
      namespace: string,
      podName: string,
      container?: string,
      tailLines: number = 200,
      timestamps: boolean = true,
      previous: boolean = false,
      signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams()

    params.set('tailLines', String(tailLines))
    params.set('timestamps', String(timestamps))
    params.set('previous', String(previous))

    if (container) {
      params.set('container', container)
    }

    return requestText(
        `/api/cluster/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/logs?${params.toString()}`,
        signal,
    )
  },
  getNamespaces: (signal?: AbortSignal) =>
      request<NamespaceInfo[]>('/api/cluster/namespaces', signal),
  getOverview: (signal?: AbortSignal) =>
      request<ClusterOverview>('/api/cluster/overview', signal),
  getNodes: (signal?: AbortSignal) =>
      request<KubernetesNode[]>('/api/cluster/nodes', signal),
  getPods: (namespace?: string, signal?: AbortSignal) => {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
    return request<KubernetesPod[]>(`/api/cluster/pods${query}`, signal)
  },
  deletePod: async (
      namespace: string,
      podName: string,
  ): Promise<WorkloadOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}`,
        {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Pod deletion failed with status ${response.status}`)
    }

    return response.json() as Promise<WorkloadOperationResponse>
  },
  getPodDetails: (namespace: string, podName: string, signal?: AbortSignal) =>
      request<PodInspection>(
          `/api/cluster/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/details`,
          signal,
      ),
  getTopology: (namespace?: string, signal?: AbortSignal) => {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
    return request<ClusterTopology>(`/api/cluster/topology${query}`, signal)
  },
  getNodeMetrics: (signal?: AbortSignal) =>
      request<NodeMetrics[]>('/api/metrics/nodes', signal),
  getPodMetrics: (namespace?: string, signal?: AbortSignal) => {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
    return request<PodMetrics[]>(`/api/metrics/pods${query}`, signal)
  },
  getNodeDetails: (nodeName: string, signal?: AbortSignal) =>
      request<NodeDetailResponse>(
          `/api/cluster/nodes/${encodeURIComponent(nodeName)}/details`,
          signal,
      ),
  getDeployments: async (namespace?: string): Promise<DeploymentInfo[]> => {
    const query = namespace
        ? `?namespace=${encodeURIComponent(namespace)}`
        : ''
    return request<DeploymentInfo[]>(`/api/cluster/deployments${query}`)
  },
  cordonNode: async (nodeName: string): Promise<NodeOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/nodes/${encodeURIComponent(nodeName)}/cordon`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
        },
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Cordon failed with status ${response.status}`)
    }
    return response.json() as Promise<NodeOperationResponse>
  },
  uncordonNode: async (nodeName: string): Promise<NodeOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/nodes/${encodeURIComponent(nodeName)}/uncordon`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
        },
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Uncordon failed with status ${response.status}`)
    }
    return response.json() as Promise<NodeOperationResponse>
  },
  getAuditRecords: (targetKind?: string, targetName?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (targetKind) params.set('targetKind', targetKind)
    if (targetName) params.set('targetName', targetName)
    const query = params.toString() ? `?${params.toString()}` : ''
    return request<OperationAuditRecord[]>(`/api/audit${query}`, signal)
  },
  precheckNodeDrain: (nodeName: string, signal?: AbortSignal) =>
      request<NodeDrainPrecheckResponse>(
          `/api/cluster/nodes/${encodeURIComponent(nodeName)}/drain/precheck`,
          signal,
      ),
  drainNode: async (nodeName: string): Promise<NodeDrainResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/nodes/${encodeURIComponent(nodeName)}/drain`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
        },
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Drain failed with status ${response.status}`)
    }
    return response.json() as Promise<NodeDrainResponse>
  },
  getNamespaceOverview: (signal?: AbortSignal) =>
      request<NamespaceOverviewItem[]>('/api/cluster/namespaces/overview', signal),
  getNamespaceDetails: (namespace: string, signal?: AbortSignal) =>
      request<NamespaceDetailResponse>(
          `/api/cluster/namespaces/${encodeURIComponent(namespace)}/details`,
          signal,
      ),
  createNamespace: async (
      name: string,
      labels?: Record<string, string>,
  ): Promise<WorkloadOperationResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/cluster/namespaces`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, labels: labels ?? {} }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Namespace creation failed with status ${response.status}`)
    }
    return response.json() as Promise<WorkloadOperationResponse>
  },
  scaleDeployment: async (
      namespace: string,
      name: string,
      replicas: number,
  ): Promise<DeploymentOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/scale?replicas=${replicas}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Scaling failed with status ${response.status}`)
    }

    return response.json()
  },
  restartDeployment: async (
      namespace: string,
      name: string,
  ): Promise<DeploymentOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/restart`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
        },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Restart failed with status ${response.status}`)
    }

    return response.json()
  },
  getDeploymentRolloutStatus: (
      namespace: string,
      name: string,
      signal?: AbortSignal,
  ) =>
      request<RolloutStatusResponse>(
          `/api/cluster/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/rollout`,
          signal,
      ),
  getDeploymentRolloutHistory: (
      namespace: string,
      name: string,
      signal?: AbortSignal,
  ) =>
      request<RolloutHistoryResponse>(
          `/api/cluster/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/rollout/history`,
          signal,
      ),
  rollbackDeployment: async (
      namespace: string,
      name: string,
      targetRevision?: number,
  ): Promise<WorkloadOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/rollback`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
              targetRevision !== undefined ? { targetRevision } : {},
          ),
        },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `Rollback failed with status ${response.status}`)
    }

    return response.json() as Promise<WorkloadOperationResponse>
  },
  getStatefulSets: async (namespace?: string): Promise<StatefulSetInfo[]> => {
    const query = namespace
        ? `?namespace=${encodeURIComponent(namespace)}`
        : ''
    return request<StatefulSetInfo[]>(`/api/cluster/statefulsets${query}`)
  },
  scaleStatefulSet: async (
      namespace: string,
      name: string,
      replicas: number,
  ): Promise<WorkloadOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/statefulsets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/scale?replicas=${replicas}`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
        },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `StatefulSet scaling failed with status ${response.status}`)
    }

    return response.json() as Promise<WorkloadOperationResponse>
  },
  restartStatefulSet: async (
      namespace: string,
      name: string,
  ): Promise<WorkloadOperationResponse> => {
    const response = await fetch(
        `${API_BASE_URL}/api/cluster/statefulsets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/restart`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
        },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(detail || `StatefulSet restart failed with status ${response.status}`)
    }

    return response.json() as Promise<WorkloadOperationResponse>
  },
}