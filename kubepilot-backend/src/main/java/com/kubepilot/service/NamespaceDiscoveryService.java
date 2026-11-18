
package com.kubepilot.service;

import com.kubepilot.dto.NamespaceResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1NamespaceList;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NamespaceDiscoveryService {

    private final CoreV1Api coreV1Api;

    public NamespaceDiscoveryService(ApiClient apiClient) {
        this.coreV1Api = new CoreV1Api(apiClient);
    }

    public List<NamespaceResponse> getNamespaces() throws ApiException {

        V1NamespaceList namespaceList =
                coreV1Api.listNamespace().execute();

        return namespaceList.getItems()
                .stream()
                .map(this::mapNamespace)
                .toList();
    }

    private NamespaceResponse mapNamespace(V1Namespace namespace) {

        String name = namespace.getMetadata() != null
                ? namespace.getMetadata().getName()
                : "Unknown";

        String status = namespace.getStatus() != null
                && namespace.getStatus().getPhase() != null
                ? namespace.getStatus().getPhase()
                : "Unknown";

        String createdAt = namespace.getMetadata() != null
                && namespace.getMetadata().getCreationTimestamp() != null
                ? namespace.getMetadata().getCreationTimestamp().toString()
                : null;

        return new NamespaceResponse(name, status, createdAt);
    }
}
