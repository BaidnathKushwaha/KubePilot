
package com.kubepilot.dto;

public record TopologyNode(
        String id,
        String type,
        String name,
        String namespace,
        String status
) {
}
