
package com.kubepilot.dto;

import java.util.List;

public record EndpointSliceResponse(
        String name,
        String namespace,
        String serviceName,
        String addressType,
        List<EndpointResponse> endpoints,
        List<EndpointPortResponse> ports
) {
}
