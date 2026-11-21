package com.kubepilot.service;

import com.kubepilot.dto.DeploymentOperationResponse;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.models.V1Deployment;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class DeploymentOperationsService {

    private static final int MAX_REPLICAS = 50;

    private final AppsV1Api appsApi;

    public DeploymentOperationsService(ApiClient apiClient) {
        this.appsApi = new AppsV1Api(apiClient);
    }

    // SCALE DEPLOYMENT

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

    // RESTART DEPLOYMENT

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

    // VALIDATION

    private void validateNamespace(String namespace) {

        if (namespace == null || namespace.isBlank()) {
            throw new IllegalArgumentException(
                    "Namespace must not be empty"
            );
        }
    }

    private void validateDeploymentName(String name) {

        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException(
                    "Deployment name must not be empty"
            );
        }
    }

    private void validateReplicas(int replicas) {

        if (replicas < 0 || replicas > MAX_REPLICAS) {
            throw new IllegalArgumentException(
                    "Replicas must be between 0 and " + MAX_REPLICAS
            );
        }
    }

    // RESPONSE

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