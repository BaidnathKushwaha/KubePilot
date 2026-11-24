package com.kubepilot.dto;

import java.util.List;

public record HpaResponse(
        String name,
        String namespace,
        String targetKind,
        String targetName,
        String targetApiVersion,
        int minReplicas,
        int maxReplicas,
        int currentReplicas,
        int desiredReplicas,
        String metricName, // cpu or memory
        Integer targetUtilizationPercent,
        Integer currentUtilizationPercent,
        String lastScaleTime,
        List<HpaConditionItem> conditions
) {
    public record HpaConditionItem(
            String type,
            String status,
            String reason,
            String message,
            String lastTransitionTime
    ) {
    }
}