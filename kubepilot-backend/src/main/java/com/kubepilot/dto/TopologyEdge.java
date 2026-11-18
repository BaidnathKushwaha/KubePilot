
package com.kubepilot.dto;

public record TopologyEdge(
        String sourceId,
        String targetId,
        String relation
) {
}
