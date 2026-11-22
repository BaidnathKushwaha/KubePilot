package com.kubepilot.dto;

import java.util.List;

public record NodeDrainPrecheckResponse(
        String nodeName,
        boolean alreadyUnschedulable,
        int totalScheduledPods,
        int evictablePodCount,
        int daemonSetPodCount,
        int unmanagedPodCount,
        int localStoragePodCount,
        int pdbBlockedPodCount,
        boolean hasBlockers,
        List<String> blockers,
        List<String> warnings,
        List<PodDrainCandidate> pods
) {
    public record PodDrainCandidate(
            String name,
            String namespace,
            String phase,
            String ownerKind,
            String ownerName,
            String category, // DEPLOYMENT_POD, REPLICA_SET_POD, STATEFUL_SET_POD, DAEMON_SET_POD, CONTROLLER_POD, UNMANAGED_POD
            boolean daemonSet,
            boolean usesLocalStorage,
            List<String> localStorageVolumes,
            boolean blockedByPdb,
            String blockingPdbName,
            boolean evictable,
            String note
    ) {
    }
}