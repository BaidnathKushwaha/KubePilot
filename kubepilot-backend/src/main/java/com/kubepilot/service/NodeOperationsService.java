package com.kubepilot.service;

import com.kubepilot.dto.NodeOperationResponse;
import com.kubepilot.dto.OperationAuditRecord;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Node;
import io.kubernetes.client.openapi.models.V1NodeSpec;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class NodeOperationsService {

    private final CoreV1Api coreV1Api;
    private final OperationAuditService auditService;

    public NodeOperationsService(ApiClient apiClient, OperationAuditService auditService) {
        this.coreV1Api = new CoreV1Api(apiClient);
        this.auditService = auditService;
    }

    public NodeOperationResponse cordonNode(String nodeName) throws ApiException {
        return setNodeUnschedulable(nodeName, true);
    }

    public NodeOperationResponse uncordonNode(String nodeName) throws ApiException {
        return setNodeUnschedulable(nodeName, false);
    }

    private NodeOperationResponse setNodeUnschedulable(String nodeName, boolean unschedulable) throws ApiException {
        String operation = unschedulable ? "CORDON" : "UNCORDON";
        String targetScheduling = unschedulable ? "UNSCHEDULABLE" : "SCHEDULABLE";

        if (nodeName == null || nodeName.isBlank()) {
            auditService.record(
                    operation,
                    "Node",
                    String.valueOf(nodeName),
                    null,
                    "REJECTED",
                    "Set unschedulable=" + unschedulable,
                    "Node name must not be empty"
            );
            throw new IllegalArgumentException("Node name must not be empty");
        }

        try {
            V1Node node = coreV1Api.readNode(nodeName).execute();
            V1NodeSpec spec = node.getSpec();
            if (spec == null) {
                spec = new V1NodeSpec();
                node.setSpec(spec);
            }

            boolean currentlyUnschedulable = Boolean.TRUE.equals(spec.getUnschedulable());
            if (currentlyUnschedulable == unschedulable) {
                String noChangeMsg = unschedulable
                        ? "Node \"" + nodeName + "\" is already cordoned (unschedulable)."
                        : "Node \"" + nodeName + "\" is already uncordoned (schedulable).";

                OperationAuditRecord audit = auditService.record(
                        operation,
                        "Node",
                        nodeName,
                        null,
                        "NO_CHANGE",
                        "Set unschedulable=" + unschedulable,
                        noChangeMsg
                );

                return new NodeOperationResponse(
                        operation,
                        nodeName,
                        "NO_CHANGE",
                        targetScheduling,
                        noChangeMsg,
                        audit.id(),
                        Instant.now()
                );
            }

            spec.setUnschedulable(unschedulable);
            coreV1Api.replaceNode(nodeName, node).execute();

            String message = unschedulable
                    ? "Node \"" + nodeName + "\" cordoned. New pods will not be scheduled on this node; existing running pods remain unaffected."
                    : "Node \"" + nodeName + "\" uncordoned. New pods can now be scheduled on this node; existing pods are not automatically moved.";

            OperationAuditRecord audit = auditService.record(
                    operation,
                    "Node",
                    nodeName,
                    null,
                    "ACCEPTED",
                    "Set unschedulable=" + unschedulable,
                    message
            );

            return new NodeOperationResponse(
                    operation,
                    nodeName,
                    "ACCEPTED",
                    targetScheduling,
                    message,
                    audit.id(),
                    Instant.now()
            );
        } catch (ApiException e) {
            auditService.record(
                    operation,
                    "Node",
                    nodeName,
                    null,
                    "FAILED",
                    "Set unschedulable=" + unschedulable,
                    "Kubernetes API error (" + e.getCode() + "): " + e.getMessage()
            );
            throw e;
        }
    }
}