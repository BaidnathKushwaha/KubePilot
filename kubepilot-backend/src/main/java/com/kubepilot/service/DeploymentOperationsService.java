package com.kubepilot.service;

import com.kubepilot.dto.DeploymentOperationResponse;
import com.kubepilot.dto.RollbackRequest;
import com.kubepilot.dto.RolloutHistoryResponse;
import com.kubepilot.dto.RolloutStatusResponse;
import com.kubepilot.dto.WorkloadOperationResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1Deployment;
import io.kubernetes.client.openapi.models.V1DeploymentCondition;
import io.kubernetes.client.openapi.models.V1DeploymentSpec;
import io.kubernetes.client.openapi.models.V1DeploymentStatus;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1OwnerReference;
import io.kubernetes.client.openapi.models.V1PodTemplateSpec;
import io.kubernetes.client.openapi.models.V1ReplicaSet;
import io.kubernetes.client.openapi.models.V1ReplicaSetList;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class DeploymentOperationsService {

    private static final int MAX_REPLICAS = 50;
    private static final String REVISION_ANNOTATION = "deployment.kubernetes.io/revision";

    private final AppsV1Api appsApi;

    public DeploymentOperationsService(ApiClient apiClient) {
        this.appsApi = new AppsV1Api(apiClient);
    }

    public DeploymentOperationResponse scaleDeployment(
            String namespace,
            String name,
            int replicas
    ) throws ApiException {

        validateNamespace(namespace);
        validateDeploymentName(name);
        validateReplicas(replicas);

        V1Deployment deployment = appsApi
                .readNamespacedDeployment(name, namespace)
                .execute();

        if (deployment.getSpec() == null) {
            throw new IllegalStateException(
                    "Deployment specification is unavailable"
            );
        }

        Integer currentReplicas = deployment.getSpec().getReplicas();

        if (currentReplicas != null && currentReplicas == replicas) {
            return response(
                    "SCALE",
                    name,
                    namespace,
                    "NO_CHANGE",
                    "Deployment already has " + replicas + " desired replicas",
                    replicas
            );
        }

        deployment.getSpec().setReplicas(replicas);

        appsApi.replaceNamespacedDeployment(
                name,
                namespace,
                deployment
        ).execute();

        return response(
                "SCALE",
                name,
                namespace,
                "ACCEPTED",
                "Deployment scaling request accepted. Kubernetes will reconcile the replica count.",
                replicas
        );
    }

    public DeploymentOperationResponse restartDeployment(
            String namespace,
            String name
    ) throws ApiException {

        validateNamespace(namespace);
        validateDeploymentName(name);

        V1Deployment deployment = appsApi
                .readNamespacedDeployment(name, namespace)
                .execute();

        if (deployment.getSpec() == null
                || deployment.getSpec().getTemplate() == null
                || deployment.getSpec().getTemplate().getMetadata() == null) {

            throw new IllegalStateException(
                    "Deployment pod template metadata is unavailable"
            );
        }

        String restartTimestamp = Instant.now().toString();

        Map<String, String> annotations =
                deployment.getSpec()
                        .getTemplate()
                        .getMetadata()
                        .getAnnotations();

        if (annotations == null) {
            annotations = new HashMap<>();
        } else {
            annotations = new HashMap<>(annotations);
        }

        annotations.put(
                "kubepilot.io/restartedAt",
                restartTimestamp
        );

        deployment.getSpec()
                .getTemplate()
                .getMetadata()
                .setAnnotations(annotations);

        appsApi.replaceNamespacedDeployment(
                name,
                namespace,
                deployment
        ).execute();

        return response(
                "RESTART",
                name,
                namespace,
                "ACCEPTED",
                "Deployment restart request accepted. Kubernetes will initiate a rolling restart.",
                null
        );
    }

    public RolloutStatusResponse getRolloutStatus(String namespace, String name) throws ApiException {
        validateNamespace(namespace);
        validateDeploymentName(name);

        V1Deployment deployment = appsApi.readNamespacedDeployment(name, namespace).execute();
        V1DeploymentSpec spec = deployment.getSpec();
        V1DeploymentStatus status = deployment.getStatus();

        int desired = spec != null && spec.getReplicas() != null ? spec.getReplicas() : 0;
        int updated = status != null && status.getUpdatedReplicas() != null ? status.getUpdatedReplicas() : 0;
        int ready = status != null && status.getReadyReplicas() != null ? status.getReadyReplicas() : 0;
        int available = status != null && status.getAvailableReplicas() != null ? status.getAvailableReplicas() : 0;
        int unavailable = status != null && status.getUnavailableReplicas() != null
                ? status.getUnavailableReplicas()
                : Math.max(0, desired - available);

        long observedGeneration = status != null && status.getObservedGeneration() != null
                ? status.getObservedGeneration()
                : 0L;
        Long generation = deployment.getMetadata() != null ? deployment.getMetadata().getGeneration() : null;
        Integer deadlineSeconds = spec != null ? spec.getProgressDeadlineSeconds() : null;

        String currentRevision = deployment.getMetadata() != null && deployment.getMetadata().getAnnotations() != null
                ? deployment.getMetadata().getAnnotations().get(REVISION_ANNOTATION)
                : null;

        List<RolloutStatusResponse.RolloutConditionItem> conditionItems = new ArrayList<>();
        boolean progressDeadlineExceeded = false;

        if (status != null && status.getConditions() != null) {
            for (V1DeploymentCondition cond : status.getConditions()) {
                conditionItems.add(new RolloutStatusResponse.RolloutConditionItem(
                        cond.getType(),
                        cond.getStatus(),
                        cond.getReason(),
                        cond.getMessage(),
                        cond.getLastUpdateTime() != null ? cond.getLastUpdateTime().toString() : null
                ));

                if ("Progressing".equals(cond.getType()) && "ProgressDeadlineExceeded".equals(cond.getReason())) {
                    progressDeadlineExceeded = true;
                }
            }
        }

        String phase;
        String summary;

        if (desired == 0) {
            phase = "SCALED_DOWN";
            summary = "Deployment is scaled to 0 desired replicas.";
        } else if (progressDeadlineExceeded) {
            phase = "STALLED";
            summary = "Rollout exceeded progress deadline (" + (deadlineSeconds != null ? deadlineSeconds + "s" : "configured deadline") + ").";
        } else if (generation != null && observedGeneration < generation) {
            phase = "PROGRESSING";
            summary = "Controller has not yet observed generation " + generation + " (observed " + observedGeneration + ").";
        } else if (updated < desired) {
            phase = "PROGRESSING";
            summary = "Updating pods: " + updated + " of " + desired + " replicas updated.";
        } else if (available < desired || ready < desired) {
            phase = unavailable > 0 ? "DEGRADED" : "PROGRESSING";
            summary = "Waiting for replicas to become ready/available (" + ready + " ready, " + available + " available of " + desired + ").";
        } else {
            phase = "COMPLETE";
            summary = "Rollout complete: all " + desired + " replicas are updated, ready, and available.";
        }

        return new RolloutStatusResponse(
                name,
                namespace,
                phase,
                summary,
                desired,
                updated,
                ready,
                available,
                unavailable,
                observedGeneration,
                generation,
                deadlineSeconds,
                currentRevision,
                conditionItems
        );
    }

    public RolloutHistoryResponse getRolloutHistory(String namespace, String name) throws ApiException {
        validateNamespace(namespace);
        validateDeploymentName(name);

        V1Deployment deployment = appsApi.readNamespacedDeployment(name, namespace).execute();
        String deploymentUid = deployment.getMetadata() != null ? deployment.getMetadata().getUid() : null;
        String currentRevisionStr = deployment.getMetadata() != null && deployment.getMetadata().getAnnotations() != null
                ? deployment.getMetadata().getAnnotations().get(REVISION_ANNOTATION)
                : null;
        Integer currentRevisionNum = parseIntOrNull(currentRevisionStr);

        V1ReplicaSetList rsList = appsApi.listNamespacedReplicaSet(namespace).execute();
        List<RolloutHistoryResponse.RevisionItem> items = new ArrayList<>();

        for (V1ReplicaSet rs : rsList.getItems()) {
            if (!isOwnedByDeployment(rs, name, deploymentUid)) {
                continue;
            }
            Map<String, String> annotations = rs.getMetadata() != null ? rs.getMetadata().getAnnotations() : null;
            Integer rev = annotations != null ? parseIntOrNull(annotations.get(REVISION_ANNOTATION)) : null;
            if (rev == null) {
                continue;
            }

            List<String> images = new ArrayList<>();
            Map<String, String> podLabels = Map.of();
            if (rs.getSpec() != null && rs.getSpec().getTemplate() != null) {
                if (rs.getSpec().getTemplate().getMetadata() != null
                        && rs.getSpec().getTemplate().getMetadata().getLabels() != null) {
                    podLabels = rs.getSpec().getTemplate().getMetadata().getLabels();
                }
                if (rs.getSpec().getTemplate().getSpec() != null
                        && rs.getSpec().getTemplate().getSpec().getContainers() != null) {
                    for (V1Container c : rs.getSpec().getTemplate().getSpec().getContainers()) {
                        if (c.getImage() != null && !images.contains(c.getImage())) {
                            images.add(c.getImage());
                        }
                    }
                }
            }

            int replicas = rs.getSpec() != null && rs.getSpec().getReplicas() != null ? rs.getSpec().getReplicas() : 0;
            int readyReplicas = rs.getStatus() != null && rs.getStatus().getReadyReplicas() != null
                    ? rs.getStatus().getReadyReplicas() : 0;
            boolean isCurrent = currentRevisionNum != null && Objects.equals(currentRevisionNum, rev);
            String createdAt = rs.getMetadata() != null && rs.getMetadata().getCreationTimestamp() != null
                    ? rs.getMetadata().getCreationTimestamp().toString() : null;

            items.add(new RolloutHistoryResponse.RevisionItem(
                    rev,
                    rs.getMetadata() != null ? rs.getMetadata().getName() : "unknown",
                    replicas,
                    readyReplicas,
                    isCurrent,
                    !isCurrent,
                    createdAt,
                    images,
                    podLabels
            ));
        }

        items.sort(Comparator.comparingInt(RolloutHistoryResponse.RevisionItem::revision).reversed());

        return new RolloutHistoryResponse(
                name,
                namespace,
                currentRevisionStr,
                items
        );
    }

    public WorkloadOperationResponse rollbackDeployment(
            String namespace,
            String name,
            RollbackRequest request
    ) throws ApiException {
        validateNamespace(namespace);
        validateDeploymentName(name);

        V1Deployment deployment = appsApi.readNamespacedDeployment(name, namespace).execute();
        if (deployment.getSpec() == null) {
            throw new IllegalStateException("Deployment specification is unavailable");
        }

        String deploymentUid = deployment.getMetadata() != null ? deployment.getMetadata().getUid() : null;
        String currentRevisionStr = deployment.getMetadata() != null && deployment.getMetadata().getAnnotations() != null
                ? deployment.getMetadata().getAnnotations().get(REVISION_ANNOTATION)
                : null;
        Integer currentRevisionNum = parseIntOrNull(currentRevisionStr);

        List<V1ReplicaSet> ownedReplicaSets = appsApi.listNamespacedReplicaSet(namespace).execute().getItems().stream()
                .filter(rs -> isOwnedByDeployment(rs, name, deploymentUid))
                .filter(rs -> rs.getMetadata() != null
                        && rs.getMetadata().getAnnotations() != null
                        && parseIntOrNull(rs.getMetadata().getAnnotations().get(REVISION_ANNOTATION)) != null)
                .sorted((a, b) -> Integer.compare(
                        parseIntOrNull(b.getMetadata().getAnnotations().get(REVISION_ANNOTATION)),
                        parseIntOrNull(a.getMetadata().getAnnotations().get(REVISION_ANNOTATION))
                ))
                .toList();

        if (ownedReplicaSets.isEmpty()) {
            throw new IllegalArgumentException("No rollout revisions found for Deployment \"" + name + "\"");
        }

        V1ReplicaSet targetRs;
        Integer targetRevision = request != null ? request.targetRevision() : null;

        if (targetRevision != null) {
            final Integer resolvedTargetRevision = targetRevision;

            targetRs = ownedReplicaSets.stream()
                    .filter(rs -> rs.getMetadata() != null
                            && rs.getMetadata().getAnnotations() != null
                            && Objects.equals(
                            parseIntOrNull(rs.getMetadata().getAnnotations().get(REVISION_ANNOTATION)),
                            resolvedTargetRevision
                    ))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Revision " + resolvedTargetRevision + " not found in history for Deployment \"" + name + "\""
                    ));
        } else {
            targetRs = ownedReplicaSets.stream()
                    .filter(rs -> !Objects.equals(
                            parseIntOrNull(rs.getMetadata().getAnnotations().get(REVISION_ANNOTATION)),
                            currentRevisionNum
                    ))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            "No previous revision available to roll back to for Deployment \"" + name + "\""
                    ));
            targetRevision = parseIntOrNull(targetRs.getMetadata().getAnnotations().get(REVISION_ANNOTATION));
        }

        if (Objects.equals(targetRevision, currentRevisionNum)) {
            throw new IllegalArgumentException(
                    "Deployment is already at revision " + targetRevision
            );
        }

        V1PodTemplateSpec rsTemplate = targetRs.getSpec() != null ? targetRs.getSpec().getTemplate() : null;
        if (rsTemplate == null || rsTemplate.getSpec() == null) {
            throw new IllegalStateException("Target revision pod template is unavailable");
        }

        V1PodTemplateSpec restoredTemplate = new V1PodTemplateSpec();
        if (rsTemplate.getMetadata() != null) {
            V1ObjectMeta metaCopy = new V1ObjectMeta();
            metaCopy.setLabels(rsTemplate.getMetadata().getLabels() != null
                    ? new HashMap<>(rsTemplate.getMetadata().getLabels()) : null);
            Map<String, String> annCopy = rsTemplate.getMetadata().getAnnotations() != null
                    ? new HashMap<>(rsTemplate.getMetadata().getAnnotations()) : new HashMap<>();
            annCopy.put("kubepilot.io/rolledBackFromRevision", String.valueOf(targetRevision));
            annCopy.put("kubepilot.io/rolledBackAt", Instant.now().toString());
            metaCopy.setAnnotations(annCopy);
            restoredTemplate.setMetadata(metaCopy);
        }
        restoredTemplate.setSpec(rsTemplate.getSpec());

        deployment.getSpec().setTemplate(restoredTemplate);
        appsApi.replaceNamespacedDeployment(name, namespace, deployment).execute();

        return new WorkloadOperationResponse(
                "ROLLBACK",
                "Deployment",
                name,
                namespace,
                "ACCEPTED",
                "Rollback request to revision " + targetRevision + " accepted. Kubernetes will reconcile the rollout.",
                deployment.getSpec().getReplicas(),
                targetRevision,
                null,
                null,
                Instant.now()
        );
    }

    private boolean isOwnedByDeployment(V1ReplicaSet rs, String deploymentName, String deploymentUid) {
        if (rs.getMetadata() == null || rs.getMetadata().getOwnerReferences() == null) {
            return false;
        }
        return rs.getMetadata().getOwnerReferences().stream()
                .anyMatch(ref -> "Deployment".equals(ref.getKind())
                        && deploymentName.equals(ref.getName())
                        && (deploymentUid == null || Objects.equals(deploymentUid, ref.getUid())));
    }

    private Integer parseIntOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private void validateNamespace(String namespace) {
        if (namespace == null || namespace.isBlank()) {
            throw new IllegalArgumentException("Namespace must not be empty");
        }
    }

    private void validateDeploymentName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Deployment name must not be empty");
        }
    }

    private void validateReplicas(int replicas) {
        if (replicas < 0 || replicas > MAX_REPLICAS) {
            throw new IllegalArgumentException("Replicas must be between 0 and " + MAX_REPLICAS);
        }
    }

    private DeploymentOperationResponse response(
            String operation,
            String name,
            String namespace,
            String status,
            String message,
            Integer desiredReplicas
    ) {
        return new DeploymentOperationResponse(
                operation,
                name,
                namespace,
                status,
                message,
                desiredReplicas,
                Instant.now()
        );
    }
}