package com.kubepilot.dto;

import java.util.List;

public record RolloutStatusResponse(
        String name,
        String namespace,
        String phase, // PROGRESSING, COMPLETE, DEGRADED, SCALED_DOWN, STALLED
        String summary,
        int desiredReplicas,
        int updatedReplicas,
        int readyReplicas,
        int availableReplicas,
        int unavailableReplicas,
        long observedGeneration,
        Long generation,
        Integer progressDeadlineSeconds,
        String currentRevision,
        List<RolloutConditionItem> conditions
) {
    public record RolloutConditionItem(
            String type,
            String status,
            String reason,
            String message,
            String lastUpdateTime
    ) {
    }
}