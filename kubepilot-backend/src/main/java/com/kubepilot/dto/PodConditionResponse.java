package com.kubepilot.dto;

public record PodConditionResponse(
        String type,
        String status,
        String reason,
        String message,
        String lastTransitionTime
) {
}