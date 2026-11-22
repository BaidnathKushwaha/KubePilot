package com.kubepilot.dto;

import java.time.Instant;

public record OperationAuditRecord(
        String id,
        String operation,
        String targetKind,
        String targetName,
        String namespace,
        String status,
        String details,
        String outcomeMessage,
        Instant timestamp
) {
}