package com.kubepilot.dto;

import java.util.Map;

public record StatefulSetResponse(
        String name,
        String namespace,
        String uid,
        int desiredReplicas,
        int currentReplicas,
        int readyReplicas,
        String serviceName,
        Map<String, String> selector,
        String createdAt
) {
}