import type {
  ClusterOverview,
  ClusterTopology,
  KubernetesNode,
  KubernetesPod,
  NodeMetrics,
  PodMetrics,
  NamespaceInfo,
} from '../types/cluster'
import type { PodInspection } from '../types/podInspection'

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
  getDeployments: async (namespace?: string) => {
    const query = namespace
        ? `?namespace=${encodeURIComponent(namespace)}`
        : ''

    const response = await fetch(
        `http://localhost:8080/api/cluster/deployments${query}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch deployments')
    }

    return response.json()
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
  getStatefulSets: async (namespace?: string) => {
    const query = namespace
        ? `?namespace=${encodeURIComponent(namespace)}`
        : ''

    const response = await fetch(
        `http://localhost:8080/api/cluster/statefulsets${query}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch StatefulSets')
    }

    return response.json()
  },
}
