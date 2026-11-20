export interface DeploymentInfo {
    name: string
    namespace: string

    desiredReplicas: number
    readyReplicas: number
    availableReplicas: number
    updatedReplicas: number

    health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'SCALED_DOWN'

    selector: Record<string, string>

    createdAt: string | null
}

export interface StatefulSetInfo {
    name: string
    namespace: string
    uid: string

    desiredReplicas: number
    currentReplicas: number
    readyReplicas: number

    serviceName: string | null

    selector: Record<string, string>

    createdAt: string | null
}