package com.kubepilot.dto;

public record RollbackRequest(
        Integer targetRevision
) {
}