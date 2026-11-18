
package com.kubepilot.service;

import com.kubepilot.dto.ClusterOverviewResponse;
import com.kubepilot.dto.NodeResponse;
import com.kubepilot.dto.PodResponse;
import com.kubepilot.dto.NamespaceResponse;
import com.kubepilot.dto.NodeMetricsResponse;

import io.kubernetes.client.openapi.ApiException;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ClusterOverviewService {

    private final NodeDiscoveryService nodeDiscoveryService;
    private final PodDiscoveryService podDiscoveryService;
    private final NamespaceDiscoveryService namespaceDiscoveryService;
    private final MetricsDiscoveryService metricsDiscoveryService;

    public ClusterOverviewService(
            NodeDiscoveryService nodeDiscoveryService,
            PodDiscoveryService podDiscoveryService,
            NamespaceDiscoveryService namespaceDiscoveryService,
            MetricsDiscoveryService metricsDiscoveryService) {

        this.nodeDiscoveryService = nodeDiscoveryService;
        this.podDiscoveryService = podDiscoveryService;
        this.namespaceDiscoveryService = namespaceDiscoveryService;
        this.metricsDiscoveryService = metricsDiscoveryService;
    }

    public ClusterOverviewResponse getOverview() throws ApiException {

        List<NodeResponse> nodes =
                nodeDiscoveryService.getNodes();

        List<PodResponse> pods =
                podDiscoveryService.getPods();

        List<NamespaceResponse> namespaces =
                namespaceDiscoveryService.getNamespaces();

        List<NodeMetricsResponse> nodeMetrics =
                metricsDiscoveryService.getNodeMetrics();

        int nodesReady = (int) nodes.stream()
                .filter(node -> "Ready".equals(node.status()))
                .count();

        int nodesNotReady = nodes.size() - nodesReady;

        int podsRunning = countPods(pods, "Running");
        int podsPending = countPods(pods, "Pending");
        int podsFailed = countPods(pods, "Failed");
        int podsSucceeded = countPods(pods, "Succeeded");

        int podsReady = (int) pods.stream()
                .filter(PodResponse::ready)
                .count();

        int podsNotReady = (int) pods.stream()
                .filter(pod ->
                        "Running".equals(pod.status()) && !pod.ready())
                .count();

        long totalCpu = nodeMetrics.stream()
                .mapToLong(NodeMetricsResponse::cpuMilliCores)
                .sum();

        long totalMemory = nodeMetrics.stream()
                .mapToLong(NodeMetricsResponse::memoryBytes)
                .sum();

        String metricsTimestamp = nodeMetrics.isEmpty()
                ? null
                : nodeMetrics.get(0).timestamp();

        return new ClusterOverviewResponse(

                nodes.size(),
                nodesReady,
                nodesNotReady,

                namespaces.size(),

                pods.size(),
                podsRunning,
                podsPending,
                podsFailed,
                podsSucceeded,
                podsReady,
                podsNotReady,

                totalCpu,
                totalMemory,

                metricsTimestamp
        );
    }

    private int countPods(List<PodResponse> pods, String status) {

        return (int) pods.stream()
                .filter(pod -> status.equals(pod.status()))
                .count();
    }
}
