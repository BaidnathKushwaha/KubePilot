
package com.kubepilot.dto;

import java.util.List;

public record EndpointResponse(
        List<String> addresses,
        Boolean ready,
        String targetRefKind,
        String targetRefName
) {
}
