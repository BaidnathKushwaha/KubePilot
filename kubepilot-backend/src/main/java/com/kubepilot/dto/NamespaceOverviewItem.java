package com.kubepilot.dto;

import java.util.List;
import java.util.Map;

public record NamespaceOverviewItem(
        String name,
        String status,
        String createdAt,
        int podCount,
        int deploymentCount,
        int serviceCount,
        List<QuotaSummary> resourceQuotas
) {
    public record QuotaSummary(
            String name,
            Map<String, String> hard,
            Map<String, String> used
    ) {
    }
}