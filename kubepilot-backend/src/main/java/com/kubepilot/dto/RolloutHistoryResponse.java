package com.kubepilot.dto;

import java.util.List;
import java.util.Map;

public record RolloutHistoryResponse(
        String deploymentName,
        String namespace,
        String currentRevision,
        List<RevisionItem> revisions
) {
    public record RevisionItem(
            int revision,
            String replicaSetName,
            int replicas,
            int readyReplicas,
            boolean current,
            boolean rollbackCandidate,
            String createdAt,
            List<String> images,
            Map<String, String> podLabels
    ) {
    }
}