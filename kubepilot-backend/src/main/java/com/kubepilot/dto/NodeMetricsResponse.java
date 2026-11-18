
package com.kubepilot.dto;

public record NodeMetricsResponse(
        String name,
        long cpuMilliCores,
        long memoryBytes,
        String timestamp,
        String window
) {
}
