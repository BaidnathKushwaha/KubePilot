package com.kubepilot.dto;

import java.util.List;

public record NodeDetailResponse(
        NodeResponse node,
        String schedulingStatus, // SCHEDULABLE or UNSCHEDULABLE
        Long cpuUsageMilliCores,
        Long memoryUsageBytes,
        String metricsTimestamp,
        List<PodResponse> scheduledPods,
        List<NodeEventItem> events
) {
    public record NodeEventItem(
            String reason,
            String type,
            String message,
            String sourceComponent,
            String eventTime
    ) {
    }
}