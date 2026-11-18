
package com.kubepilot.dto;

public record ContainerMetricsResponse(
        String name,
        long cpuMilliCores,
        long memoryBytes
) {
}
