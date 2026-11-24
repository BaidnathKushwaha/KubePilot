
package com.kubepilot.dto;

import java.time.Instant;

public record PrometheusStatusResponse(
        boolean connected,
        boolean configured,
        String prometheusUrl,
        String query,
        int resultCount,
        Instant checkedAt,
        String message
) {
}
