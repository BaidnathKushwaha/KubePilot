package com.kubepilot.dto;

import java.util.List;
import java.util.Map;

public record StatefulSetResponse(
        String name,
        String namespace,
        String uid,

        int desiredReplicas,
        int currentReplicas,
        int readyReplicas,

        String serviceName,

        String health,

        Map<String, String> selector,

        List<String> volumeClaimTemplates,

        String createdAt
) {
}