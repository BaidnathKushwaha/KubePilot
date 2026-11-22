package com.kubepilot.dto;

import java.util.List;
import java.util.Map;

public record NodeResponse(
        String name,
        String status,
        String kubernetesVersion,
        String architecture,
        Map<String, String> capacity,
        String internalIP,
        String operatingSystem,
        String osImage,
        String containerRuntime,
        boolean unschedulable,
        String podCapacity,
        Map<String, String> allocatable,
        List<NodeConditionItem> conditions,
        List<NodeTaintItem> taints,
        Map<String, String> labels
) {
    public record NodeConditionItem(
            String type,
            String status,
            String reason,
            String message,
            String lastTransitionTime
    ) {
    }

    public record NodeTaintItem(
            String key,
            String value,
            String effect
    ) {
    }
}