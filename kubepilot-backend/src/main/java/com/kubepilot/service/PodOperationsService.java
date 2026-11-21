package com.kubepilot.service;

import com.kubepilot.dto.WorkloadOperationResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1OwnerReference;
import io.kubernetes.client.openapi.models.V1Pod;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class PodOperationsService {

    private final CoreV1Api coreV1Api;

    public PodOperationsService(ApiClient apiClient) {
        this.coreV1Api = new CoreV1Api(apiClient);
    }

    public WorkloadOperationResponse deletePod(String namespace, String podName) throws ApiException {
        validateNotBlank(namespace, "Namespace must not be empty");
        validateNotBlank(podName, "Pod name must not be empty");

        V1Pod existing = coreV1Api.readNamespacedPod(podName, namespace).execute();

        String ownerKind = null;
        String ownerName = null;

        if (existing.getMetadata() != null && existing.getMetadata().getOwnerReferences() != null) {
            V1OwnerReference controller = existing.getMetadata().getOwnerReferences().stream()
                    .filter(ref -> Boolean.TRUE.equals(ref.getController()))
                    .findFirst()
                    .orElseGet(() -> existing.getMetadata().getOwnerReferences().isEmpty()
                            ? null
                            : existing.getMetadata().getOwnerReferences().get(0));

            if (controller != null) {
                ownerKind = controller.getKind();
                ownerName = controller.getName();
            }
        }

        coreV1Api.deleteNamespacedPod(podName, namespace).execute();

        String message = ownerKind != null
                ? "Pod deletion request accepted. Because this pod is owned by " + ownerKind
                + (ownerName != null ? " \"" + ownerName + "\"" : "")
                + ", its controller will reconcile replacement pods asynchronously."
                : "Pod deletion request accepted. Because this standalone pod has no controller owner, it will not be recreated automatically.";

        return new WorkloadOperationResponse(
                "DELETE",
                "Pod",
                podName,
                namespace,
                "ACCEPTED",
                message,
                null,
                null,
                ownerKind,
                ownerName,
                Instant.now()
        );
    }

    private void validateNotBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }
}