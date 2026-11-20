package com.kubepilot.service;

import com.kubepilot.dto.PodConditionResponse;
import com.kubepilot.dto.PodContainerResponse;
import com.kubepilot.dto.PodDetailResponse;
import com.kubepilot.dto.PodVolumeResponse;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.*;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class PodInspectionService {

    private final CoreV1Api coreV1Api;

    public PodInspectionService(ApiClient apiClient) {
        this.coreV1Api = new CoreV1Api(apiClient);
    }

    public PodDetailResponse inspectPod(
            String namespace,
            String podName) throws ApiException {

        V1Pod pod = coreV1Api
                .readNamespacedPod(podName, namespace)
                .execute();

        return mapPodDetails(pod);
    }

    private PodDetailResponse mapPodDetails(V1Pod pod) {

        V1ObjectMeta metadata = pod.getMetadata();
        V1PodSpec spec = pod.getSpec();
        V1PodStatus status = pod.getStatus();

        String phase = status != null && status.getPhase() != null
                ? status.getPhase()
                : "Unknown";

        String nodeName = spec != null ? spec.getNodeName() : null;

        String podIP = status != null ? status.getPodIP() : null;

        String hostIP = status != null ? status.getHostIP() : null;

        String createdAt = metadata != null
                && metadata.getCreationTimestamp() != null
                ? metadata.getCreationTimestamp().toString()
                : null;

        String startTime = status != null
                && status.getStartTime() != null
                ? status.getStartTime().toString()
                : null;

        String uid = metadata != null ? metadata.getUid() : null;

        Map<String, String> labels = metadata != null
                && metadata.getLabels() != null
                ? Map.copyOf(metadata.getLabels())
                : Map.of();

        Map<String, String> annotations = metadata != null
                && metadata.getAnnotations() != null
                ? Map.copyOf(metadata.getAnnotations())
                : Map.of();

        // Ownership

        String ownerKind = null;
        String ownerName = null;
        String ownerUid = null;

        if (metadata != null && metadata.getOwnerReferences() != null) {

            V1OwnerReference controllerOwner =
                    metadata.getOwnerReferences()
                            .stream()
                            .filter(ref ->
                                    Boolean.TRUE.equals(ref.getController()))
                            .findFirst()
                            .orElse(null);

            if (controllerOwner != null) {
                ownerKind = controllerOwner.getKind();
                ownerName = controllerOwner.getName();
                ownerUid = controllerOwner.getUid();
            }
        }

        // Conditions

        List<PodConditionResponse> conditions = new ArrayList<>();

        if (status != null && status.getConditions() != null) {

            for (V1PodCondition condition : status.getConditions()) {

                conditions.add(new PodConditionResponse(
                        condition.getType(),
                        condition.getStatus(),
                        condition.getReason(),
                        condition.getMessage(),
                        condition.getLastTransitionTime() != null
                                ? condition.getLastTransitionTime().toString()
                                : null
                ));
            }
        }

        // Container details

        List<PodContainerResponse> containers =
                mapContainers(pod);

        int restarts = containers.stream()
                .mapToInt(PodContainerResponse::restartCount)
                .sum();

        boolean ready = !containers.isEmpty()
                && containers.stream()
                .allMatch(PodContainerResponse::ready);

        // Volume details

        List<PodVolumeResponse> volumes =
                mapVolumes(pod);

        return new PodDetailResponse(
                metadata != null ? metadata.getName() : null,
                metadata != null ? metadata.getNamespace() : null,
                uid,
                phase,
                nodeName,
                podIP,
                hostIP,
                createdAt,
                startTime,
                ready,
                restarts,
                ownerKind,
                ownerName,
                ownerUid,
                labels,
                annotations,
                conditions,
                containers,
                volumes
        );
    }

    // CONTAINERS

    private List<PodContainerResponse> mapContainers(V1Pod pod) {

        List<PodContainerResponse> result = new ArrayList<>();

        V1PodSpec spec = pod.getSpec();
        V1PodStatus status = pod.getStatus();

        Map<String, V1ContainerStatus> statusMap = new HashMap<>();

        if (status != null
                && status.getContainerStatuses() != null) {

            for (V1ContainerStatus containerStatus
                    : status.getContainerStatuses()) {

                statusMap.put(
                        containerStatus.getName(),
                        containerStatus
                );
            }
        }

        if (spec != null && spec.getContainers() != null) {

            for (V1Container container : spec.getContainers()) {

                V1ContainerStatus containerStatus =
                        statusMap.get(container.getName());

                String containerID = containerStatus != null
                        ? containerStatus.getContainerID()
                        : null;

                String state = "UNKNOWN";
                String stateReason = null;
                String stateMessage = null;

                if (containerStatus != null
                        && containerStatus.getState() != null) {

                    V1ContainerState containerState =
                            containerStatus.getState();

                    if (containerState.getRunning() != null) {
                        state = "RUNNING";

                    } else if (containerState.getWaiting() != null) {
                        state = "WAITING";

                        stateReason =
                                containerState.getWaiting().getReason();

                        stateMessage =
                                containerState.getWaiting().getMessage();

                    } else if (containerState.getTerminated() != null) {
                        state = "TERMINATED";

                        stateReason =
                                containerState.getTerminated().getReason();

                        stateMessage =
                                containerState.getTerminated().getMessage();
                    }
                }

                boolean containerReady = containerStatus != null
                        && Boolean.TRUE.equals(
                        containerStatus.getReady());

                int restartCount = containerStatus != null
                        && containerStatus.getRestartCount() != null
                        ? containerStatus.getRestartCount()
                        : 0;

                // Last termination information

                String lastTerminationReason = null;
                String lastTerminationMessage = null;
                String lastTerminationExitCode = null;
                String lastTerminationTime = null;

                // Resource requests and limits

                V1ResourceRequirements resources =
                        container.getResources();

                String cpuRequest = getResource(
                        resources,
                        "requests",
                        "cpu"
                );

                String cpuLimit = getResource(
                        resources,
                        "limits",
                        "cpu"
                );

                String memoryRequest = getResource(
                        resources,
                        "requests",
                        "memory"
                );

                String memoryLimit = getResource(
                        resources,
                        "limits",
                        "memory"
                );

                result.add(new PodContainerResponse(
                        container.getName(),
                        container.getImage(),
                        containerID,
                        state,
                        stateReason,
                        stateMessage,
                        containerReady,
                        restartCount,
                        lastTerminationReason,
                        lastTerminationMessage,
                        lastTerminationExitCode,
                        lastTerminationTime,
                        cpuRequest,
                        cpuLimit,
                        memoryRequest,
                        memoryLimit
                ));
            }
        }

        return result;
    }

    private String getResource(
            V1ResourceRequirements resources,
            String category,
            String resourceName) {

        if (resources == null) {
            return null;
        }

        Map<String, Quantity> resourceMap;

        if ("requests".equals(category)) {
            resourceMap = resources.getRequests();
        } else {
            resourceMap = resources.getLimits();
        }

        if (resourceMap == null) {
            return null;
        }

        Quantity quantity = resourceMap.get(resourceName);

        if (quantity == null) {
            return null;
        }

        return quantity.toSuffixedString();
    }

    // VOLUMES

    private List<PodVolumeResponse> mapVolumes(V1Pod pod) {

        List<PodVolumeResponse> result = new ArrayList<>();

        V1PodSpec spec = pod.getSpec();

        if (spec == null || spec.getVolumes() == null) {
            return result;
        }

        for (V1Volume volume : spec.getVolumes()) {

            String type = "UNKNOWN";
            String source = null;

            if (volume.getPersistentVolumeClaim() != null) {

                type = "PERSISTENT_VOLUME_CLAIM";

                source = volume.getPersistentVolumeClaim()
                        .getClaimName();

            } else if (volume.getEmptyDir() != null) {

                type = "EMPTY_DIR";

                source = "emptyDir";

            } else if (volume.getConfigMap() != null) {

                type = "CONFIG_MAP";

                source = volume.getConfigMap().getName();

            } else if (volume.getSecret() != null) {

                type = "SECRET";

                source = volume.getSecret().getSecretName();

            } else if (volume.getHostPath() != null) {

                type = "HOST_PATH";

                source = volume.getHostPath().getPath();

            } else if (volume.getProjected() != null) {

                type = "PROJECTED";

                source = "projected";

            } else if (volume.getNfs() != null) {

                type = "NFS";

                source = volume.getNfs().getPath();
            }

            List<String> mountPaths = new ArrayList<>();

            if (spec.getContainers() != null) {

                for (V1Container container : spec.getContainers()) {

                    if (container.getVolumeMounts() == null) {
                        continue;
                    }

                    for (V1VolumeMount mount
                            : container.getVolumeMounts()) {

                        if (volume.getName().equals(
                                mount.getName())) {

                            mountPaths.add(
                                    container.getName()
                                            + ": "
                                            + mount.getMountPath()
                            );
                        }
                    }
                }
            }

            result.add(new PodVolumeResponse(
                    volume.getName(),
                    type,
                    source,
                    mountPaths
            ));
        }

        return result;
    }
}