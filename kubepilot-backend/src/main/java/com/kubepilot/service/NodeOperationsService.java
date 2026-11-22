package com.kubepilot.service;

import com.kubepilot.dto.NodeDrainPrecheckResponse;
import com.kubepilot.dto.NodeDrainResponse;
import com.kubepilot.dto.NodeOperationResponse;
import com.kubepilot.dto.OperationAuditRecord;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.apis.PolicyV1Api;
import io.kubernetes.client.openapi.models.V1Eviction;
import io.kubernetes.client.openapi.models.V1LabelSelector;
import io.kubernetes.client.openapi.models.V1Node;
import io.kubernetes.client.openapi.models.V1NodeSpec;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1OwnerReference;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodDisruptionBudget;
import io.kubernetes.client.openapi.models.V1Volume;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class NodeOperationsService {

    private final CoreV1Api coreV1Api;
    private final PolicyV1Api policyV1Api;
    private final OperationAuditService auditService;

    public NodeOperationsService(ApiClient apiClient, OperationAuditService auditService) {
        this.coreV1Api = new CoreV1Api(apiClient);
        this.policyV1Api = new PolicyV1Api(apiClient);
        this.auditService = auditService;
    }

    public NodeOperationResponse cordonNode(String nodeName) throws ApiException {
        return setNodeUnschedulable(nodeName, true);
    }

    public NodeOperationResponse uncordonNode(String nodeName) throws ApiException {
        return setNodeUnschedulable(nodeName, false);
    }

    public NodeDrainPrecheckResponse precheckDrain(String nodeName) throws ApiException {
        validateNodeName(nodeName, "DRAIN_PRECHECK");

        V1Node node = coreV1Api.readNode(nodeName).execute();
        boolean alreadyUnschedulable = node.getSpec() != null && Boolean.TRUE.equals(node.getSpec().getUnschedulable());

        List<V1Pod> nodePods = coreV1Api.listPodForAllNamespaces().execute().getItems().stream()
                .filter(p -> p.getSpec() != null && nodeName.equals(p.getSpec().getNodeName()))
                .filter(p -> !"Succeeded".equals(p.getStatus() != null ? p.getStatus().getPhase() : null))
                .toList();

        List<V1PodDisruptionBudget> allPdbs = new ArrayList<>();
        try {
            allPdbs.addAll(policyV1Api.listPodDisruptionBudgetForAllNamespaces().execute().getItems());
        } catch (ApiException ignored) {
            // PDB API may be empty or restricted in minimal clusters
        }

        List<NodeDrainPrecheckResponse.PodDrainCandidate> candidates = new ArrayList<>();
        List<String> blockers = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        int evictableCount = 0;
        int daemonSetCount = 0;
        int unmanagedCount = 0;
        int localStorageCount = 0;
        int pdbBlockedCount = 0;

        for (V1Pod pod : nodePods) {
            String podName = pod.getMetadata() != null ? pod.getMetadata().getName() : "unknown";
            String ns = pod.getMetadata() != null ? pod.getMetadata().getNamespace() : "default";
            String phase = pod.getStatus() != null && pod.getStatus().getPhase() != null ? pod.getStatus().getPhase() : "Unknown";
            Map<String, String> labels = pod.getMetadata() != null && pod.getMetadata().getLabels() != null
                    ? pod.getMetadata().getLabels() : Map.of();

            String ownerKind = null;
            String ownerName = null;
            if (pod.getMetadata() != null && pod.getMetadata().getOwnerReferences() != null) {
                V1OwnerReference owner = pod.getMetadata().getOwnerReferences().stream()
                        .filter(ref -> Boolean.TRUE.equals(ref.getController()))
                        .findFirst()
                        .orElse(pod.getMetadata().getOwnerReferences().isEmpty() ? null : pod.getMetadata().getOwnerReferences().get(0));
                if (owner != null) {
                    ownerKind = owner.getKind();
                    ownerName = owner.getName();
                }
            }

            boolean isDaemonSet = "DaemonSet".equals(ownerKind);
            boolean isUnmanaged = ownerKind == null;

            String category;
            if (isDaemonSet) {
                category = "DAEMON_SET_POD";
            } else if ("ReplicaSet".equals(ownerKind)) {
                category = "REPLICA_SET_POD";
            } else if ("StatefulSet".equals(ownerKind)) {
                category = "STATEFUL_SET_POD";
            } else if (isUnmanaged) {
                category = "UNMANAGED_POD";
            } else {
                category = "CONTROLLER_POD";
            }

            List<String> localVols = new ArrayList<>();
            if (pod.getSpec() != null && pod.getSpec().getVolumes() != null) {
                for (V1Volume vol : pod.getSpec().getVolumes()) {
                    if (vol.getEmptyDir() != null) {
                        localVols.add(vol.getName() + " (emptyDir)");
                    } else if (vol.getHostPath() != null) {
                        localVols.add(vol.getName() + " (hostPath)");
                    }
                }
            }
            boolean usesLocalStorage = !localVols.isEmpty();

            String blockingPdbName = null;
            boolean blockedByPdb = false;
            if (!isDaemonSet) {
                for (V1PodDisruptionBudget pdb : allPdbs) {
                    String pdbNs = pdb.getMetadata() != null ? pdb.getMetadata().getNamespace() : null;
                    if (!Objects.equals(pdbNs, ns)) {
                        continue;
                    }
                    V1LabelSelector selector = pdb.getSpec() != null ? pdb.getSpec().getSelector() : null;
                    if (matchesSelector(selector != null ? selector.getMatchLabels() : null, labels)) {
                        Integer disruptionsAllowed = pdb.getStatus() != null ? pdb.getStatus().getDisruptionsAllowed() : null;
                        if (disruptionsAllowed != null && disruptionsAllowed <= 0) {
                            blockedByPdb = true;
                            blockingPdbName = pdb.getMetadata() != null ? pdb.getMetadata().getName() : "PDB";
                            break;
                        }
                    }
                }
            }

            boolean evictable = !isDaemonSet && !isUnmanaged && !blockedByPdb;
            String note;
            if (isDaemonSet) {
                daemonSetCount++;
                note = "DaemonSet pod; skipped during standard drain (managed per node by DaemonSet controller).";
                warnings.add("DaemonSet pod " + ns + "/" + podName + " will be skipped during drain.");
            } else if (isUnmanaged) {
                unmanagedCount++;
                note = "Unmanaged standalone pod (no controller owner); protected from automatic eviction without explicit handling.";
                blockers.add("Unmanaged pod " + ns + "/" + podName + " has no controller owner.");
            } else if (blockedByPdb) {
                pdbBlockedCount++;
                note = "Blocked by PodDisruptionBudget \"" + blockingPdbName + "\" (0 disruptions allowed).";
                blockers.add("PDB " + ns + "/" + blockingPdbName + " blocks eviction of pod " + podName + ".");
            } else {
                evictableCount++;
                note = usesLocalStorage
                        ? "Evictable controller-managed pod using local storage; local ephemeral/host data will not migrate."
                        : "Evictable via Kubernetes Eviction API.";
            }

            if (usesLocalStorage && !isDaemonSet) {
                localStorageCount++;
                warnings.add("Pod " + ns + "/" + podName + " uses local storage: " + String.join(", ", localVols));
            }

            candidates.add(new NodeDrainPrecheckResponse.PodDrainCandidate(
                    podName,
                    ns,
                    phase,
                    ownerKind,
                    ownerName,
                    category,
                    isDaemonSet,
                    usesLocalStorage,
                    localVols,
                    blockedByPdb,
                    blockingPdbName,
                    evictable,
                    note
            ));
        }

        return new NodeDrainPrecheckResponse(
                nodeName,
                alreadyUnschedulable,
                nodePods.size(),
                evictableCount,
                daemonSetCount,
                unmanagedCount,
                localStorageCount,
                pdbBlockedCount,
                !blockers.isEmpty(),
                blockers,
                warnings,
                candidates
        );
    }

    public NodeDrainResponse drainNode(String nodeName) throws ApiException {
        validateNodeName(nodeName, "DRAIN");

        // 1. Cordon first so no new pods schedule onto the node
        setNodeUnschedulable(nodeName, true);

        NodeDrainPrecheckResponse precheck = precheckDrain(nodeName);
        List<String> evictedPods = new ArrayList<>();
        List<String> skippedDaemonSetPods = new ArrayList<>();
        List<NodeDrainResponse.PodEvictionFailure> failedOrBlocked = new ArrayList<>();

        for (NodeDrainPrecheckResponse.PodDrainCandidate candidate : precheck.pods()) {
            if (candidate.daemonSet()) {
                skippedDaemonSetPods.add(candidate.namespace() + "/" + candidate.name());
                continue;
            }

            if (!candidate.evictable()) {
                failedOrBlocked.add(new NodeDrainResponse.PodEvictionFailure(
                        candidate.name(),
                        candidate.namespace(),
                        candidate.blockedByPdb() ? "PDB_BLOCKED" : "UNMANAGED_POD",
                        candidate.note()
                ));
                continue;
            }

            try {
                V1Eviction eviction = new V1Eviction()
                        .metadata(new V1ObjectMeta()
                                .name(candidate.name())
                                .namespace(candidate.namespace()));
                coreV1Api.createNamespacedPodEviction(candidate.name(), candidate.namespace(), eviction).execute();
                evictedPods.add(candidate.namespace() + "/" + candidate.name());
            } catch (ApiException ex) {
                failedOrBlocked.add(new NodeDrainResponse.PodEvictionFailure(
                        candidate.name(),
                        candidate.namespace(),
                        "EVICTION_FAILED_" + ex.getCode(),
                        ex.getMessage() != null ? ex.getMessage() : "Eviction rejected by Kubernetes API"
                ));
            }
        }

        List<String> remainingPods = coreV1Api.listPodForAllNamespaces().execute().getItems().stream()
                .filter(p -> p.getSpec() != null && nodeName.equals(p.getSpec().getNodeName()))
                .filter(p -> !"Succeeded".equals(p.getStatus() != null ? p.getStatus().getPhase() : null))
                .map(p -> (p.getMetadata() != null ? p.getMetadata().getNamespace() : "default")
                        + "/" + (p.getMetadata() != null ? p.getMetadata().getName() : "unknown"))
                .toList();

        String status;
        boolean readyForMaintenance;
        String summary;

        if (!failedOrBlocked.isEmpty()) {
            status = "PARTIAL_FAILURE";
            readyForMaintenance = false;
            summary = "Drain completed with blockers/failures: " + evictedPods.size()
                    + " pod(s) evicted, " + failedOrBlocked.size()
                    + " pod(s) blocked or failed, " + skippedDaemonSetPods.size()
                    + " DaemonSet pod(s) skipped.";
        } else {
            status = "COMPLETED";
            readyForMaintenance = true;
            summary = "Drain eviction requests submitted: " + evictedPods.size()
                    + " pod(s) evicted, " + skippedDaemonSetPods.size()
                    + " DaemonSet pod(s) skipped. Node is cordoned and ready for maintenance once terminating pods exit.";
        }

        OperationAuditRecord audit = auditService.record(
                "DRAIN",
                "Node",
                nodeName,
                null,
                status,
                "evicted=" + evictedPods.size() + ", skippedDaemonSets=" + skippedDaemonSetPods.size() + ", failedOrBlocked=" + failedOrBlocked.size(),
                summary
        );

        return new NodeDrainResponse(
                nodeName,
                status,
                true,
                readyForMaintenance,
                summary,
                evictedPods,
                skippedDaemonSetPods,
                failedOrBlocked,
                remainingPods,
                audit.id(),
                Instant.now()
        );
    }

    private boolean matchesSelector(Map<String, String> selector, Map<String, String> labels) {
        if (selector == null || selector.isEmpty() || labels == null) {
            return false;
        }
        return selector.entrySet().stream()
                .allMatch(e -> Objects.equals(labels.get(e.getKey()), e.getValue()));
    }

    private void validateNodeName(String nodeName, String operation) {
        if (nodeName == null || nodeName.isBlank()) {
            auditService.record(
                    operation,
                    "Node",
                    String.valueOf(nodeName),
                    null,
                    "REJECTED",
                    "Validate node name",
                    "Node name must not be empty"
            );
            throw new IllegalArgumentException("Node name must not be empty");
        }
    }

    private NodeOperationResponse setNodeUnschedulable(String nodeName, boolean unschedulable) throws ApiException {
        String operation = unschedulable ? "CORDON" : "UNCORDON";
        String targetScheduling = unschedulable ? "UNSCHEDULABLE" : "SCHEDULABLE";
        validateNodeName(nodeName, operation);

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