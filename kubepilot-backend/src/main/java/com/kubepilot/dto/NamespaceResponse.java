
package com.kubepilot.dto;

public record NamespaceResponse(
        String name,
        String status,
        String createdAt
) {
}
