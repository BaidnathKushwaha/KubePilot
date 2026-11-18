
package com.kubepilot.dto;

import java.util.List;
import java.util.Map;

public record ServiceResponse(
        String name,
        String namespace,
        String type,
        String clusterIP,
        Map<String, String> selector,
        List<ServicePortResponse> ports,
        String createdAt
) {
}
