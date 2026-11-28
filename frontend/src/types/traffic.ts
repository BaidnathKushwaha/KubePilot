export interface WorkloadResourceItem {
    kind: 'Deployment' | 'StatefulSet' | string
    name: string
    namespace: string
    desiredReplicas: number
    readyReplicas: number
    metricsAvailable: boolean
    metricsSource?: string | null
    metricsTimestamp?: string | null
    cpuUsageMilliCores: number
    memoryUsageBytes: number
    cpuRequestMilliCores: number | null
    cpuLimitMilliCores: number | null
    memoryRequestBytes: number | null
    memoryLimitBytes: number | null
    cpuUsagePercent: number | null
    memoryUsagePercent: number | null
    overloaded: boolean
    warningCodes: string[]
}

export interface OverloadWarningItem {
    warningKey: string
    code: string
    severity: string
    resourceKind: string
    resourceName: string
    namespace: string
    observedPercent: number
    thresholdPercent: number
    message: string
}

export interface WorkloadPressureResponse {
    namespace: string | null
    cpuThresholdPercent: number
    memoryThresholdPercent: number
    nearLimitPercent: number
    metricsServerAvailable: boolean
    trafficMetricsAvailable: boolean
    trafficStatusNote: string
    metricsSource?: string | null
    metricsTimestamp?: string | null
    staleMetrics?: boolean
    workloads: WorkloadResourceItem[]
    warnings: OverloadWarningItem[]
}
export interface HpaConditionItem {
    type: string
    status: string
    reason: string | null
    message: string | null
    lastTransitionTime: string | null
}

export interface HpaResponse {
    name: string
    namespace: string
    targetKind: string
    targetName: string
    targetApiVersion: string
    minReplicas: number
    maxReplicas: number
    currentReplicas: number
    desiredReplicas: number
    metricName: string
    targetUtilizationPercent: number | null
    currentUtilizationPercent: number | null
    lastScaleTime: string | null
    conditions: HpaConditionItem[]
}

export interface HpaUpsertRequest {
    name: string
    namespace: string
    targetKind: 'Deployment' | 'StatefulSet'
    targetName: string
    minReplicas: number
    maxReplicas: number
    metricName: 'cpu' | 'memory'
    targetUtilizationPercent: number
}

export interface ServiceEndpointTarget {
    address: string
    ready: boolean
    targetKind: string | null
    targetName: string | null
    sliceName: string
    trafficRateNote: string
}

export interface ServicePortItem {
    name: string | null
    protocol: string | null
    port: number
    targetPort: string | null
    nodePort: number | null
}

export interface ServiceDistributionItem {
    name: string
    namespace: string
    type: string | null
    clusterIP: string | null
    ingressHosts: string[]
    ports: ServicePortItem[]
    matchedWorkloads: string[]
    readyEndpointCount: number
    unreadyEndpointCount: number
    endpoints: ServiceEndpointTarget[]
}

export interface ServiceTrafficResponse {
    namespace: string | null
    trafficRateTelemetryAvailable: boolean
    trafficTelemetryNote: string
    services: ServiceDistributionItem[]
}