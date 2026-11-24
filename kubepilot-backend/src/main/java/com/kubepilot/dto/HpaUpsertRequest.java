package com.kubepilot.dto;

public record HpaUpsertRequest(
        String name,
        String namespace,
        String targetKind, // Deployment or StatefulSet
        String targetName,
        Integer minReplicas,
        Integer maxReplicas,
        String metricName, // cpu or memory
        Integer targetUtilizationPercent
) {
}