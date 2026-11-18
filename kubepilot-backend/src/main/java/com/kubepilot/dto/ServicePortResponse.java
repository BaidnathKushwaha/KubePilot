
package com.kubepilot.dto;

public record ServicePortResponse(
        String name,
        String protocol,
        int port,
        String targetPort,
        Integer nodePort
) {
}
