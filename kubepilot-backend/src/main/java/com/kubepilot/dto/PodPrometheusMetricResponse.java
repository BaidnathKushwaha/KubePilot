package com.kubepilot.dto;

import java.time.Instant;

public record PodPrometheusMetricResponse(
        String namespace,
        String pod,
        Double cpuUsageCores,
        Double memoryUsageBytes,
        Instant timestamp
) {
}