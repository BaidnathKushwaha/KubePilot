package com.kubepilot.dto;

import java.time.Instant;
import java.util.List;

public record NodeDrainResponse(
        String nodeName,
        String status, // COMPLETED, PARTIAL_FAILURE, BLOCKED
        boolean cordoned,
        boolean readyForMaintenance,
        String summary,
        List<String> evictedPods,
        List<String> skippedDaemonSetPods,
        List<PodEvictionFailure> failedOrBlockedPods,
        List<String> remainingPods,
        String auditId,
        Instant timestamp
) {
    public record PodEvictionFailure(
            String name,
            String namespace,
            String reason,
            String message
    ) {
    }
}