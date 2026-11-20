package com.kubepilot.dto;

import java.util.List;

public record PodVolumeResponse(
        String name,
        String type,
        String source,
        List<String> mountPaths
) {
}