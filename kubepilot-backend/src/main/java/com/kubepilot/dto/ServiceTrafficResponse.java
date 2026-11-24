package com.kubepilot.dto;

import java.util.List;

public record ServiceTrafficResponse(
        String namespace,
        boolean trafficRateTelemetryAvailable,
        String trafficTelemetryNote,
        List<ServiceDistributionItem> services
) {
    public record ServiceDistributionItem(
            String name,
            String namespace,
            String type,
            String clusterIP,
            List<String> ingressHosts,
            List<ServicePortResponse> ports,
            List<String> matchedWorkloads,
            int readyEndpointCount,
            int unreadyEndpointCount,
            List<EndpointTargetItem> endpoints
    ) {
    }

    public record EndpointTargetItem(
            String address,
            boolean ready,
            String targetKind,
            String targetName,
            String sliceName,
            String trafficRateNote
    ) {
    }
}