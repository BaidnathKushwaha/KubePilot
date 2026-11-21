package com.kubepilot.dto;

import java.time.Instant;

public record DeploymentOperationResponse(
        String operation,
        String name,
        String namespace,
        String status,
        String message,
        Integer desiredReplicas,
        Instant timestamp
) {
}