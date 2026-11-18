
package com.kubepilot.dto;

public record IngressRouteResponse(
        String host,
        String path,
        String pathType,
        String serviceName,
        String servicePort
) {
}
