
package com.kubepilot.dto;

public record PodResponse(
        String name,
        String namespace,
        String status,
        String nodeName,
        String podIP,
        int restarts,
        String createdAt,
        boolean ready
) {
}
