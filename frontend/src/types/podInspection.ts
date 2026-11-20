export interface PodCondition {
    type: string
    status: string
    reason: string | null
    message: string | null
    lastTransitionTime: string | null
}

export interface PodContainerDetail {
    name: string
    image: string
    containerID: string | null
    state: string
    stateReason: string | null
    stateMessage: string | null
    ready: boolean
    restartCount: number
    lastTerminationReason: string | null
    lastTerminationMessage: string | null
    lastTerminationExitCode: string | null
    lastTerminationTime: string | null
    cpuRequest: string | null
    cpuLimit: string | null
    memoryRequest: string | null
    memoryLimit: string | null
}

export interface PodVolume {
    name: string
    type: string
    source: string | null
    mountPaths: string[]
}

export interface PodInspection {
    name: string
    namespace: string
    uid: string
    phase: string
    nodeName: string | null
    podIP: string | null
    hostIP: string | null
    createdAt: string | null
    startTime: string | null
    ready: boolean
    restarts: number
    ownerKind: string | null
    ownerName: string | null
    ownerUid: string | null
    labels: Record<string, string>
    annotations: Record<string, string>
    conditions: PodCondition[]
    containers: PodContainerDetail[]
    volumes: PodVolume[]
}