package com.kubepilot.dto;

import java.util.Map;

public record PodResponse(
        String name,
        String namespace,
        String status,
        String nodeName,
        String podIP,
        int restarts,
        String createdAt,
        boolean ready,
        Map<String, String> labels,
        String ownerKind,
        String ownerName,
        String ownerUid
) {
}