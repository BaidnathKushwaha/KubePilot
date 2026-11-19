import type {
  ClusterOverview,
  KubernetesNode,
  KubernetesPod,
  NodeMetrics,
  PodMetrics,
} from '../types/cluster'

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
  getOverview: (signal?: AbortSignal) =>
    request<ClusterOverview>('/api/cluster/overview', signal),
  getNodes: (signal?: AbortSignal) =>
    request<KubernetesNode[]>('/api/cluster/nodes', signal),
  getPods: (signal?: AbortSignal) =>
    request<KubernetesPod[]>('/api/cluster/pods', signal),
  getNodeMetrics: (signal?: AbortSignal) =>
    request<NodeMetrics[]>('/api/metrics/nodes', signal),
  getPodMetrics: (namespace?: string, signal?: AbortSignal) => {
    const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
    return request<PodMetrics[]>(`/api/metrics/pods${query}`, signal)
  },
}
