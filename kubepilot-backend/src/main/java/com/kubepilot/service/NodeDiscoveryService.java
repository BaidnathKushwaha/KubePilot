package com.kubepilot.service;

import com.kubepilot.dto.NodeDetailResponse;
import com.kubepilot.dto.NodeMetricsResponse;
import com.kubepilot.dto.NodeResponse;
import com.kubepilot.dto.PodResponse;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.CoreV1Event;
import io.kubernetes.client.openapi.models.CoreV1EventList;
import io.kubernetes.client.openapi.models.V1Node;
import io.kubernetes.client.openapi.models.V1NodeAddress;
import io.kubernetes.client.openapi.models.V1NodeCondition;
import io.kubernetes.client.openapi.models.V1NodeList;
import io.kubernetes.client.openapi.models.V1NodeSpec;
import io.kubernetes.client.openapi.models.V1NodeStatus;
import io.kubernetes.client.openapi.models.V1NodeSystemInfo;
import io.kubernetes.client.openapi.models.V1Taint;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NodeDiscoveryService {

    private final CoreV1Api coreV1Api;
    private final PodDiscoveryService podDiscoveryService;
    private final MetricsDiscoveryService metricsDiscoveryService;

    public NodeDiscoveryService(
            ApiClient apiClient,
            PodDiscoveryService podDiscoveryService,
            MetricsDiscoveryService metricsDiscoveryService) {
        this.coreV1Api = new CoreV1Api(apiClient);
        this.podDiscoveryService = podDiscoveryService;
        this.metricsDiscoveryService = metricsDiscoveryService;
    }

    public List<NodeResponse> getNodes() throws ApiException {

        V1NodeList nodeList = coreV1Api.listNode().execute();

        return nodeList.getItems()
                .stream()
                .map(this::mapNode)
                .toList();
    }

    public NodeDetailResponse getNodeDetails(String nodeName) throws ApiException {
        if (nodeName == null || nodeName.isBlank()) {
            throw new IllegalArgumentException("Node name must not be empty");
        }

        V1Node v1Node = coreV1Api.readNode(nodeName).execute();
        NodeResponse node = mapNode(v1Node);
        String schedulingStatus = node.unschedulable() ? "UNSCHEDULABLE" : "SCHEDULABLE";

        List<PodResponse> scheduledPods = podDiscoveryService.getPods().stream()
                .filter(pod -> nodeName.equals(pod.nodeName()))
                .toList();

        Long cpuUsage = null;
        Long memoryUsage = null;
        String metricsTimestamp = null;

        try {
            List<NodeMetricsResponse> allMetrics = metricsDiscoveryService.getNodeMetrics();
            for (NodeMetricsResponse m : allMetrics) {
                if (nodeName.equals(m.name())) {
                    cpuUsage = m.cpuMilliCores();
                    memoryUsage = m.memoryBytes();
                    metricsTimestamp = m.timestamp();
                    break;
                }
            }
        } catch (ApiException ignored) {
            // Metrics API may be unavailable; return null usage without failing node details
        }

        List<NodeDetailResponse.NodeEventItem> events = new ArrayList<>();
        try {
            CoreV1EventList eventList = coreV1Api.listEventForAllNamespaces().execute();
            for (CoreV1Event ev : eventList.getItems()) {
                if (ev.getInvolvedObject() != null
                        && "Node".equals(ev.getInvolvedObject().getKind())
                        && nodeName.equals(ev.getInvolvedObject().getName())) {
                    String time = ev.getEventTime() != null
                            ? ev.getEventTime().toString()
                            : ev.getLastTimestamp() != null
                            ? ev.getLastTimestamp().toString()
                            : ev.getFirstTimestamp() != null
                            ? ev.getFirstTimestamp().toString()
                            : null;
                    String sourceComponent = ev.getSource() != null ? ev.getSource().getComponent() : ev.getReportingComponent();
                    events.add(new NodeDetailResponse.NodeEventItem(
                            ev.getReason(),
                            ev.getType(),
                            ev.getMessage(),
                            sourceComponent,
                            time
                    ));
                }
            }
            events.sort(Comparator.comparing(
                    NodeDetailResponse.NodeEventItem::eventTime,
                    Comparator.nullsLast(Comparator.reverseOrder())
            ));
        } catch (ApiException ignored) {
            // Event listing failure should not block core node inspection
        }

        return new NodeDetailResponse(
                node,
                schedulingStatus,
                cpuUsage,
                memoryUsage,
                metricsTimestamp,
                scheduledPods,
                events
        );
    }

    private NodeResponse mapNode(V1Node node) {

        String status = "Unknown";

        V1NodeStatus nodeStatus = node.getStatus();
        V1NodeSpec nodeSpec = node.getSpec();

        List<NodeResponse.NodeConditionItem> conditions = new ArrayList<>();

        if (nodeStatus != null && nodeStatus.getConditions() != null) {
            status = nodeStatus.getConditions()
                    .stream()
                    .filter(condition ->
                            "Ready".equals(condition.getType()))
                    .map(V1NodeCondition::getStatus)
                    .map(value -> "True".equals(value) ? "Ready" : "NotReady")
                    .findFirst()
                    .orElse("Unknown");

            for (V1NodeCondition condition : nodeStatus.getConditions()) {
                conditions.add(new NodeResponse.NodeConditionItem(
                        condition.getType(),
                        condition.getStatus(),
                        condition.getReason(),
                        condition.getMessage(),
                        condition.getLastTransitionTime() != null
                                ? condition.getLastTransitionTime().toString()
                                : null
                ));
            }
        }

        V1NodeSystemInfo systemInfo =
                nodeStatus != null ? nodeStatus.getNodeInfo() : null;

        Map<String, String> capacity = new HashMap<>();
        Map<String, String> allocatable = new HashMap<>();

        if (nodeStatus != null && nodeStatus.getCapacity() != null) {
            for (Map.Entry<String, Quantity> entry :
                    nodeStatus.getCapacity().entrySet()) {

                capacity.put(
                        entry.getKey(),
                        entry.getValue().toSuffixedString()
                );
            }
        }

        if (nodeStatus != null && nodeStatus.getAllocatable() != null) {
            for (Map.Entry<String, Quantity> entry :
                    nodeStatus.getAllocatable().entrySet()) {

                allocatable.put(
                        entry.getKey(),
                        entry.getValue().toSuffixedString()
                );
            }
        }

        String internalIP = null;
        if (nodeStatus != null && nodeStatus.getAddresses() != null) {
            for (V1NodeAddress addr : nodeStatus.getAddresses()) {
                if ("InternalIP".equals(addr.getType())) {
                    internalIP = addr.getAddress();
                    break;
                }
            }
        }

        boolean unschedulable = nodeSpec != null && Boolean.TRUE.equals(nodeSpec.getUnschedulable());

        List<NodeResponse.NodeTaintItem> taints = new ArrayList<>();
        if (nodeSpec != null && nodeSpec.getTaints() != null) {
            for (V1Taint taint : nodeSpec.getTaints()) {
                taints.add(new NodeResponse.NodeTaintItem(
                        taint.getKey(),
                        taint.getValue(),
                        taint.getEffect()
                ));
            }
        }

        Map<String, String> labels = node.getMetadata() != null && node.getMetadata().getLabels() != null
                ? Map.copyOf(node.getMetadata().getLabels())
                : Map.of();

        String podCapacity = capacity.get("pods");

        return new NodeResponse(
                node.getMetadata() != null ? node.getMetadata().getName() : "Unknown",
                status,
                systemInfo != null ? systemInfo.getKubeletVersion() : "Unknown",
                systemInfo != null ? systemInfo.getArchitecture() : "Unknown",
                capacity,
                internalIP,
                systemInfo != null ? systemInfo.getOperatingSystem() : null,
                systemInfo != null ? systemInfo.getOsImage() : null,
                systemInfo != null ? systemInfo.getContainerRuntimeVersion() : null,
                unschedulable,
                podCapacity,
                allocatable,
                conditions,
                taints,
                labels
        );
    }
}