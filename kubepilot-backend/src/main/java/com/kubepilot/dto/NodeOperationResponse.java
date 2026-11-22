package com.kubepilot.dto;

import java.time.Instant;

public record NodeOperationResponse(
        String operation,
        String nodeName,
        String status,
        String schedulingStatus,
        String message,
        String auditId,
        Instant timestamp
) {
}