package com.kubepilot.dto;

import java.time.Instant;
import java.util.List;

public record PrometheusMetricsResponse(
        boolean success,
        String message,
        String namespace,
        Instant queriedAt,
        List<PodPrometheusMetricResponse> metrics
) {
}