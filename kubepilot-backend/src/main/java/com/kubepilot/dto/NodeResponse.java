package com.kubepilot.dto;

import java.util.Map;

public record NodeResponse(
        String name,
        String status,
        String kubernetesVersion,
        String architecture,
        Map<String, String> capacity
) {
}