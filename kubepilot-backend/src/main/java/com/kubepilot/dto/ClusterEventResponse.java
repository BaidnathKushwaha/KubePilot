package com.kubepilot.dto;

public record ClusterEventResponse(
        String uid,
        String type, // Normal, Warning, Error
        String reason,
        String message,
        int count,
        String involvedKind,
        String involvedName,
        String involvedNamespace,
        String sourceComponent,
        String timestamp
) {
}