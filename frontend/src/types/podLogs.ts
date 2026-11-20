export interface PodLogsRequest {
    namespace: string
    podName: string
    container?: string
    tailLines?: number
    timestamps?: boolean
    previous?: boolean
}