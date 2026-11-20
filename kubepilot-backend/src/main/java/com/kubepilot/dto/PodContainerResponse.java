package com.kubepilot.dto;

public record PodContainerResponse(
        String name,
        String image,
        String containerID,
        String state,
        String stateReason,
        String stateMessage,
        boolean ready,
        int restartCount,
        String lastTerminationReason,
        String lastTerminationMessage,
        String lastTerminationExitCode,
        String lastTerminationTime,
        String cpuRequest,
        String cpuLimit,
        String memoryRequest,
        String memoryLimit
) {
}