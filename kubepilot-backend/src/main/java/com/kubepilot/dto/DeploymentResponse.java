package com.kubepilot.dto;

import java.util.Map;

public record DeploymentResponse(
        String name,
        String namespace,

        int desiredReplicas,
        int readyReplicas,
        int availableReplicas,
        int updatedReplicas,

        String health,

        Map<String, String> selector,

        String createdAt
) {
}