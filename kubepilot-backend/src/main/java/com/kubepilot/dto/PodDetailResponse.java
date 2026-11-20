package com.kubepilot.dto;

import java.util.List;
import java.util.Map;

public record PodDetailResponse(
        String name,
        String namespace,
        String uid,
        String phase,
        String nodeName,
        String podIP,
        String hostIP,
        String createdAt,
        String startTime,
        boolean ready,
        int restarts,
        String ownerKind,
        String ownerName,
        String ownerUid,
        Map<String, String> labels,
        Map<String, String> annotations,
        List<PodConditionResponse> conditions,
        List<PodContainerResponse> containers,
        List<PodVolumeResponse> volumes
) {
}
