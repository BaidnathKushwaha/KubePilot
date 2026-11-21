package com.kubepilot.dto;

import java.time.Instant;

public record WorkloadOperationResponse(
        String operation,
        String resourceKind,
        String name,
        String namespace,
        String status,
        String message,
        Integer desiredReplicas,
        Integer targetRevision,
        String ownerKind,
        String ownerName,
        Instant timestamp
) {
}