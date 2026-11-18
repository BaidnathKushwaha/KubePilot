
package com.kubepilot.dto;

public record EndpointPortResponse(
        String name,
        String protocol,
        Integer port
) {
}
