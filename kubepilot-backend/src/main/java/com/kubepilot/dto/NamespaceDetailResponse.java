package com.kubepilot.dto;

import java.util.List;
import java.util.Map;

public record NamespaceDetailResponse(
        String name,
        String status,
        String createdAt,
        Map<String, String> labels,
        List<PodResponse> pods,
        List<DeploymentResponse> deployments,
        List<StatefulSetResponse> statefulSets,
        List<DaemonSetSummary> daemonSets,
        List<ServiceResponse> services,
        List<ConfigMapSummary> configMaps,
        List<SecretMetadataSummary> secretsMetadataOnly,
        List<NamespaceOverviewItem.QuotaSummary> resourceQuotas,
        List<LimitRangeSummary> limitRanges,
        List<NodeDetailResponse.NodeEventItem> events
) {
    public record DaemonSetSummary(
            String name,
            int desiredNumberScheduled,
            int currentNumberScheduled,
            int numberReady
    ) {
    }

    public record ConfigMapSummary(
            String name,
            int dataKeyCount,
            String createdAt
    ) {
    }

    public record SecretMetadataSummary(
            String name,
            String type,
            int dataKeyCount,
            String createdAt
    ) {
    }

    public record LimitRangeSummary(
            String name,
            int itemCount
    ) {
    }
}