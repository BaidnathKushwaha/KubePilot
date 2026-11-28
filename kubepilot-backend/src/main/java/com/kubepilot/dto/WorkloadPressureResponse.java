package com.kubepilot.dto;

import java.time.Instant;
import java.util.List;

public record WorkloadPressureResponse(
        String namespace,
        double cpuThresholdPercent,
        double memoryThresholdPercent,
        double nearLimitPercent,
        boolean metricsServerAvailable,
        boolean trafficMetricsAvailable,
        String trafficStatusNote,
        String metricsSource,
        Instant metricsTimestamp,
        boolean staleMetrics,
        List<WorkloadResourceItem> workloads,
        List<OverloadWarningItem> warnings
) {
    public WorkloadPressureResponse(
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
        this(
                namespace,
                cpuThresholdPercent,
                memoryThresholdPercent,
                nearLimitPercent,
                metricsServerAvailable,
                trafficMetricsAvailable,
                trafficStatusNote,
                metricsServerAvailable ? "METRICS_SERVER" : "UNAVAILABLE",
                null,
                false,
                workloads,
                warnings
        );
    }

    public record WorkloadResourceItem(
            String kind, // Deployment, StatefulSet
            String name,
            String namespace,
            int desiredReplicas,
            int readyReplicas,
            boolean metricsAvailable,
            String metricsSource,
            Instant metricsTimestamp,
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
        public WorkloadResourceItem(
                String kind,
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
            this(
                    kind,
                    name,
                    namespace,
                    desiredReplicas,
                    readyReplicas,
                    metricsAvailable,
                    metricsAvailable ? "METRICS_SERVER" : "UNAVAILABLE",
                    null,
                    cpuUsageMilliCores,
                    memoryUsageBytes,
                    cpuRequestMilliCores,
                    cpuLimitMilliCores,
                    memoryRequestBytes,
                    memoryLimitBytes,
                    cpuUsagePercent,
                    memoryUsagePercent,
                    overloaded,
                    warningCodes
            );
        }
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