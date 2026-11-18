
package com.kubepilot.service;

import com.kubepilot.dto.PodResponse;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodList;
import io.kubernetes.client.openapi.models.V1ContainerStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PodDiscoveryService {

    private final CoreV1Api coreV1Api;

    public PodDiscoveryService(ApiClient apiClient) {
        this.coreV1Api = new CoreV1Api(apiClient);
    }


    public List<PodResponse> getPods() throws ApiException {

        V1PodList podList =
                coreV1Api.listPodForAllNamespaces().execute();

        return mapPods(podList);
    }

    public List<PodResponse> getPodsByNamespace(String namespace)
            throws ApiException {

        V1PodList podList =
                coreV1Api.listNamespacedPod(namespace).execute();

        return mapPods(podList);
    }

    private List<PodResponse> mapPods(V1PodList podList) {

        return podList.getItems()
                .stream()
                .map(this::mapPod)
                .toList();
    }

    private PodResponse mapPod(V1Pod pod) {

        String name = pod.getMetadata() != null
                ? pod.getMetadata().getName()
                : "Unknown";

        String namespace = pod.getMetadata() != null
                ? pod.getMetadata().getNamespace()
                : "Unknown";

        String createdAt = pod.getMetadata() != null
                && pod.getMetadata().getCreationTimestamp() != null
                ? pod.getMetadata().getCreationTimestamp().toString()
                : null;

        String status = pod.getStatus() != null
                && pod.getStatus().getPhase() != null
                ? pod.getStatus().getPhase()
                : "Unknown";

        String podIP = pod.getStatus() != null
                ? pod.getStatus().getPodIP()
                : null;

        String nodeName = pod.getSpec() != null
                ? pod.getSpec().getNodeName()
                : null;

        int restarts = 0;
        boolean ready = false;

        if (pod.getStatus() != null
                && pod.getStatus().getContainerStatuses() != null
                && !pod.getStatus().getContainerStatuses().isEmpty()) {

            List<V1ContainerStatus> containerStatuses =
                    pod.getStatus().getContainerStatuses();

            restarts = containerStatuses.stream()
                    .mapToInt(container ->
                            container.getRestartCount() != null
                                    ? container.getRestartCount()
                                    : 0)
                    .sum();

            ready = containerStatuses.stream()
                    .allMatch(container ->
                            Boolean.TRUE.equals(container.getReady()));
        }

        return new PodResponse(
                name,
                namespace,
                status,
                nodeName,
                podIP,
                restarts,
                createdAt,
                ready
        );
    }
}
