package com.kubepilot.dto;

import java.util.Map;

public record CreateNamespaceRequest(
        String name,
        Map<String, String> labels
) {
}