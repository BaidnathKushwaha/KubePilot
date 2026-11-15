package com.kubepilot.service;

import com.kubepilot.dto.NodeResponse;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Node;
import io.kubernetes.client.openapi.models.V1NodeList;
import io.kubernetes.client.openapi.models.V1NodeStatus;
import io.kubernetes.client.openapi.models.V1NodeCondition;
import io.kubernetes.client.openapi.models.V1NodeSystemInfo;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.ApiClient;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NodeDiscoveryService {

    private final CoreV1Api coreV1Api;

    public NodeDiscoveryService(ApiClient apiClient) {
        this.coreV1Api = new CoreV1Api(apiClient);
    }

    public List<NodeResponse> getNodes() throws ApiException {

        V1NodeList nodeList = coreV1Api.listNode().execute();

        return nodeList.getItems()
                .stream()
                .map(this::mapNode)
                .toList();
    }

    private NodeResponse mapNode(V1Node node) {

        String status = "Unknown";

        V1NodeStatus nodeStatus = node.getStatus();

        if (nodeStatus != null && nodeStatus.getConditions() != null) {
            status = nodeStatus.getConditions()
                    .stream()
                    .filter(condition ->
                            "Ready".equals(condition.getType()))
                    .map(V1NodeCondition::getStatus)
                    .map(value -> "True".equals(value) ? "Ready" : "NotReady")
                    .findFirst()
                    .orElse("Unknown");
        }

        V1NodeSystemInfo systemInfo =
                nodeStatus != null ? nodeStatus.getNodeInfo() : null;

        Map<String, String> capacity = new HashMap<>();

        if (nodeStatus != null && nodeStatus.getCapacity() != null) {
            for (Map.Entry<String, Quantity> entry :
                    nodeStatus.getCapacity().entrySet()) {

                capacity.put(
                        entry.getKey(),
                        entry.getValue().toSuffixedString()
                );
            }
        }

        return new NodeResponse(
                node.getMetadata().getName(),
                status,
                systemInfo != null ? systemInfo.getKubeletVersion() : "Unknown",
                systemInfo != null ? systemInfo.getArchitecture() : "Unknown",
                capacity
        );
    }
}