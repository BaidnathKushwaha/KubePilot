
package com.kubepilot.dto;

import java.util.List;

public record IngressResponse(
        String name,
        String namespace,
        String ingressClassName,
        List<String> hosts,
        List<IngressRouteResponse> routes,
        String createdAt
) {
}
