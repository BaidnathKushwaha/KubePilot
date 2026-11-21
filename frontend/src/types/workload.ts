export interface StatefulSetInfo {
    name: string
    namespace: string
    uid: string
    desiredReplicas: number
    currentReplicas: number
    readyReplicas: number
    serviceName: string | null
    health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'SCALED_DOWN'
    selector: Record<string, string>
    volumeClaimTemplates: string[]
    createdAt: string | null
}

export interface DeploymentInfo {
    name: string
    namespace: string
    uid: string
    desiredReplicas: number
    currentReplicas: number
    readyReplicas: number
    availableReplicas: number
    updatedReplicas: number
    health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'SCALED_DOWN'
    selector: Record<string, string>
    createdAt: string | null
}

export interface WorkloadOperationResponse {
    operation: string
    resourceKind: string
    name: string
    namespace: string
    status: string
    message: string
    desiredReplicas: number | null
    targetRevision: number | null
    ownerKind: string | null
    ownerName: string | null
    timestamp: string
}

export interface RolloutConditionItem {
    type: string
    status: string
    reason: string | null
    message: string | null
    lastUpdateTime: string | null
}

export interface RolloutStatusResponse {
    name: string
    namespace: string
    phase: 'PROGRESSING' | 'COMPLETE' | 'DEGRADED' | 'SCALED_DOWN' | 'STALLED' | string
    summary: string
    desiredReplicas: number
    updatedReplicas: number
    readyReplicas: number
    availableReplicas: number
    unavailableReplicas: number
    observedGeneration: number
    generation: number | null
    progressDeadlineSeconds: number | null
    currentRevision: string | null
    conditions: RolloutConditionItem[]
}

export interface RolloutRevisionItem {
    revision: number
    replicaSetName: string
    replicas: number
    readyReplicas: number
    current: boolean
    rollbackCandidate: boolean
    createdAt: string | null
    images: string[]
    podLabels: Record<string, string>
}

export interface RolloutHistoryResponse {
    deploymentName: string
    namespace: string
    currentRevision: string | null
    revisions: RolloutRevisionItem[]
}