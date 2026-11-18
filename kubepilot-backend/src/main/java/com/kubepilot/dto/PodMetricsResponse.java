
package com.kubepilot.dto;

import java.util.List;

public record PodMetricsResponse(
        String name,
        String namespace,
        long cpuMilliCores,
        long memoryBytes,
        String timestamp,
        String window,
        List<ContainerMetricsResponse> containers
) {
}
