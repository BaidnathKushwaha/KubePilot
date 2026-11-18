
package com.kubepilot.dto;

public record ClusterOverviewResponse(

        int nodesTotal,
        int nodesReady,
        int nodesNotReady,

        int namespacesTotal,

        int podsTotal,
        int podsRunning,
        int podsPending,
        int podsFailed,
        int podsSucceeded,
        int podsReady,
        int podsNotReady,

        long cpuMilliCores,
        long memoryBytes,

        String metricsTimestamp

) {
}
