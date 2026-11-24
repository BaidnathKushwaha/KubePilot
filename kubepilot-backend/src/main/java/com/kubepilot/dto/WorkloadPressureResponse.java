package com.kubepilot.dto;

import java.util.List;

public record WorkloadPressureResponse(
        String namespace,
        double cpuThresholdPercent,
        double memoryThresholdPercent,
        double nearLimitPercent,
        boolean metricsServerAvailable,
        boolean trafficMetricsAvailable,
        String trafficStatusNote,
        List<WorkloadResourceItem> workloads,
        List<OverloadWarningItem> warnings
) {
    public record WorkloadResourceItem(
            String kind, // Deployment, StatefulSet
            String name,
            String namespace,
            int desiredReplicas,
            int readyReplicas,
            boolean metricsAvailable,
            long cpuUsageMilliCores,
            long memoryUsageBytes,
            Long cpuRequestMilliCores,
            Long cpuLimitMilliCores,
            Long memoryRequestBytes,
            Long memoryLimitBytes,
            Double cpuUsagePercent,
            Double memoryUsagePercent,
            boolean overloaded,
            List<String> warningCodes
    ) {
    }

    public record OverloadWarningItem(
            String warningKey,
            String code, // HIGH_CPU, HIGH_MEMORY, NEAR_CPU_LIMIT, NEAR_MEMORY_LIMIT
            String severity, // WARNING, HIGH
            String resourceKind,
            String resourceName,
            String namespace,
            double observedPercent,
            double thresholdPercent,
            String message
    ) {
    }
}