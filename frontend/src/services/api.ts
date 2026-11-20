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

export const clusterApi = {
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
