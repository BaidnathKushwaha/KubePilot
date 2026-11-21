package com.kubepilot.service;

import com.kubepilot.dto.WorkloadOperationResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.models.V1StatefulSet;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class StatefulSetOperationsService {

    private static final int MAX_REPLICAS = 50;

    private final AppsV1Api appsApi;

    public StatefulSetOperationsService(ApiClient apiClient) {
        this.appsApi = new AppsV1Api(apiClient);
    }

    public WorkloadOperationResponse scaleStatefulSet(
            String namespace,
            String name,
            int replicas
    ) throws ApiException {
        validateNotBlank(namespace, "Namespace must not be empty");
        validateNotBlank(name, "StatefulSet name must not be empty");
        validateReplicas(replicas);

        V1StatefulSet statefulSet = appsApi.readNamespacedStatefulSet(name, namespace).execute();

        if (statefulSet.getSpec() == null) {
            throw new IllegalStateException("StatefulSet specification is unavailable");
        }

        Integer currentReplicas = statefulSet.getSpec().getReplicas();
        if (currentReplicas != null && currentReplicas == replicas) {
            return response(
                    "SCALE",
                    name,
                    namespace,
                    "NO_CHANGE",
                    "StatefulSet already has " + replicas + " desired replicas",
                    replicas
            );
        }

        statefulSet.getSpec().setReplicas(replicas);
        appsApi.replaceNamespacedStatefulSet(name, namespace, statefulSet).execute();

        return response(
                "SCALE",
                name,
                namespace,
                "ACCEPTED",
                "StatefulSet scaling request accepted. Kubernetes will reconcile ordered pod replicas according to the StatefulSet controller.",
                replicas
        );
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

    private void validateReplicas(int replicas) {
        if (replicas < 0 || replicas > MAX_REPLICAS) {
            throw new IllegalArgumentException("Replicas must be between 0 and " + MAX_REPLICAS);
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