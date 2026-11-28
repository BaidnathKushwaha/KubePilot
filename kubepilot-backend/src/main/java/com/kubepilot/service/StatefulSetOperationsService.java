package com.kubepilot.service;

import com.kubepilot.dto.WorkloadOperationResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.AutoscalingV2Api;
import io.kubernetes.client.openapi.models.V1StatefulSet;
import io.kubernetes.client.openapi.models.V2CrossVersionObjectReference;
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscaler;
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscalerList;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class StatefulSetOperationsService {

    private static final int MIN_REPLICAS = 0;
    private static final int MAX_REPLICAS = 50;

    private final AppsV1Api appsApi;
    private final AutoscalingV2Api autoscalingApi;
    private final OperationAuditService auditService;

    public StatefulSetOperationsService(ApiClient apiClient, OperationAuditService auditService) {
        this.appsApi = new AppsV1Api(apiClient);
        this.autoscalingApi = new AutoscalingV2Api(apiClient);
        this.auditService = auditService;
    }

    public WorkloadOperationResponse scaleStatefulSet(
            String namespace,
            String name,
            int replicas
    ) throws ApiException {
        String ns = namespace != null ? namespace.trim() : "";
        String stsName = name != null ? name.trim() : "";

        if (ns.isEmpty()) {
            auditService.record("SCALE", "StatefulSet", stsName.isEmpty() ? "unknown" : stsName, null, "REJECTED",
                    "previousReplicas=unknown, requestedReplicas=" + replicas, "Namespace must not be empty");
            throw new IllegalArgumentException("Namespace must not be empty");
        }
        if (stsName.isEmpty()) {
            auditService.record("SCALE", "StatefulSet", "unknown", ns, "REJECTED",
                    "previousReplicas=unknown, requestedReplicas=" + replicas, "StatefulSet name must not be empty");
            throw new IllegalArgumentException("StatefulSet name must not be empty");
        }
        if (replicas < MIN_REPLICAS || replicas > MAX_REPLICAS) {
            String msg = "Replicas must be between " + MIN_REPLICAS + " and " + MAX_REPLICAS + " (guardrail only; does not guarantee cluster capacity)";
            auditService.record("SCALE", "StatefulSet", stsName, ns, "REJECTED",
                    "previousReplicas=unknown, requestedReplicas=" + replicas, msg);
            throw new IllegalArgumentException(msg);
        }

        try {
            V1StatefulSet statefulSet = appsApi.readNamespacedStatefulSet(stsName, ns).execute();

            if (statefulSet.getSpec() == null) {
                throw new IllegalStateException("StatefulSet specification is unavailable");
            }

            int previousReplicas = statefulSet.getSpec().getReplicas() != null
                    ? statefulSet.getSpec().getReplicas()
                    : 0;

            String hpaAdvisory = findTargetingHpaAdvisory(ns, "StatefulSet", stsName);

            if (previousReplicas == replicas) {
                String msg = "StatefulSet already has " + replicas + " desired replicas (previous=" + previousReplicas + ", requested=" + replicas + ")."
                        + (hpaAdvisory != null ? " " + hpaAdvisory : "");
                auditService.record("SCALE", "StatefulSet", stsName, ns, "NO_CHANGE",
                        "previousReplicas=" + previousReplicas + ", requestedReplicas=" + replicas
                                + (hpaAdvisory != null ? ", hpaAdvisory=" + hpaAdvisory : ""),
                        msg);
                return response("SCALE", stsName, ns, "NO_CHANGE", msg, replicas);
            }

            statefulSet.getSpec().setReplicas(replicas);
            appsApi.replaceNamespacedStatefulSet(stsName, ns, statefulSet).execute();

            String msg = "StatefulSet scaling request accepted (previous=" + previousReplicas + ", requested=" + replicas
                    + "; 0-50 bounds are an operational guardrail, not a guarantee of cluster capacity). Kubernetes will reconcile ordered pod replicas according to the StatefulSet controller."
                    + (hpaAdvisory != null ? " " + hpaAdvisory : "");
            auditService.record("SCALE", "StatefulSet", stsName, ns, "ACCEPTED",
                    "previousReplicas=" + previousReplicas + ", requestedReplicas=" + replicas
                            + (hpaAdvisory != null ? ", hpaAdvisory=" + hpaAdvisory : ""),
                    msg);

            return response("SCALE", stsName, ns, "ACCEPTED", msg, replicas);
        } catch (ApiException e) {
            auditService.record("SCALE", "StatefulSet", stsName, ns, "FAILED",
                    "requestedReplicas=" + replicas, "Kubernetes API error (" + e.getCode() + "): " + e.getMessage());
            throw e;
        }
    }

    private String findTargetingHpaAdvisory(String namespace, String kind, String targetName) {
        try {
            V2HorizontalPodAutoscalerList hpaList = autoscalingApi
                    .listNamespacedHorizontalPodAutoscaler(namespace)
                    .execute();
            if (hpaList.getItems() == null) {
                return null;
            }
            List<String> matches = new ArrayList<>();
            for (V2HorizontalPodAutoscaler hpa : hpaList.getItems()) {
                if (hpa.getSpec() == null || hpa.getSpec().getScaleTargetRef() == null || hpa.getMetadata() == null) {
                    continue;
                }
                V2CrossVersionObjectReference ref = hpa.getSpec().getScaleTargetRef();
                if (kind.equals(ref.getKind()) && targetName.equals(ref.getName())) {
                    int min = hpa.getSpec().getMinReplicas() != null ? hpa.getSpec().getMinReplicas() : 1;
                    int max = hpa.getSpec().getMaxReplicas();
                    matches.add(hpa.getMetadata().getName() + " (" + min + ".." + max + " replicas)");
                }
            }
            if (matches.isEmpty()) {
                return null;
            }
            return "HPA Advisory: Targeted by " + String.join(", ", matches)
                    + "; the HorizontalPodAutoscaler controller may override manual replica changes.";
        } catch (ApiException ignored) {
            return null;
        }
    }

    public WorkloadOperationResponse restartStatefulSet(
            String namespace,
            String name
    ) throws ApiException {
        validateNotBlank(namespace, "Namespace must not be empty");
        validateNotBlank(name, "StatefulSet name must not be empty");

        V1StatefulSet statefulSet = appsApi.readNamespacedStatefulSet(name, namespace).execute();

        if (statefulSet.getSpec() == null
                || statefulSet.getSpec().getTemplate() == null
                || statefulSet.getSpec().getTemplate().getMetadata() == null) {
            throw new IllegalStateException("StatefulSet pod template metadata is unavailable");
        }

        String strategyType = statefulSet.getSpec().getUpdateStrategy() != null
                && statefulSet.getSpec().getUpdateStrategy().getType() != null
                ? statefulSet.getSpec().getUpdateStrategy().getType()
                : "RollingUpdate";

        Map<String, String> annotations = statefulSet.getSpec()
                .getTemplate()
                .getMetadata()
                .getAnnotations();

        Map<String, String> updatedAnnotations = annotations == null
                ? new HashMap<>()
                : new HashMap<>(annotations);

        updatedAnnotations.put("kubepilot.io/restartedAt", Instant.now().toString());
        statefulSet.getSpec().getTemplate().getMetadata().setAnnotations(updatedAnnotations);

        appsApi.replaceNamespacedStatefulSet(name, namespace, statefulSet).execute();

        return response(
                "RESTART",
                name,
                namespace,
                "ACCEPTED",
                "StatefulSet restart request accepted. Pod template annotation updated; Kubernetes will reconcile using strategy "
                        + strategyType + ".",
                statefulSet.getSpec().getReplicas()
        );
    }

    private void validateNotBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    private WorkloadOperationResponse response(
            String operation,
            String name,
            String namespace,
            String status,
            String message,
            Integer desiredReplicas
    ) {
        return new WorkloadOperationResponse(
                operation,
                "StatefulSet",
                name,
                namespace,
                status,
                message,
                desiredReplicas,
                null,
                null,
                null,
                Instant.now()
        );
    }
}