package com.kubepilot.service;

import com.kubepilot.dto.*;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.CoreV1Event;
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1DaemonSet;
import io.kubernetes.client.openapi.models.V1LimitRange;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1NamespaceList;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1ResourceQuota;
import io.kubernetes.client.openapi.models.V1Secret;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class NamespaceManagementService {

    private static final Pattern DNS_LABEL_PATTERN = Pattern.compile("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$");

    private final CoreV1Api coreV1Api;
    private final AppsV1Api appsV1Api;
    private final PodDiscoveryService podDiscoveryService;
    private final ResourceDiscoveryService resourceDiscoveryService;
    private final OperationAuditService auditService;

    public NamespaceManagementService(
            ApiClient apiClient,
            PodDiscoveryService podDiscoveryService,
            ResourceDiscoveryService resourceDiscoveryService,
            OperationAuditService auditService) {
        this.coreV1Api = new CoreV1Api(apiClient);
        this.appsV1Api = new AppsV1Api(apiClient);
        this.podDiscoveryService = podDiscoveryService;
        this.resourceDiscoveryService = resourceDiscoveryService;
        this.auditService = auditService;
    }

    public List<NamespaceOverviewItem> getNamespaceOverview() throws ApiException {
        V1NamespaceList nsList = coreV1Api.listNamespace().execute();
        List<PodResponse> allPods = podDiscoveryService.getPods();
        List<DeploymentResponse> allDeployments = resourceDiscoveryService.getDeployments(null);
        List<ServiceResponse> allServices = resourceDiscoveryService.getServices(null);

        Map<String, List<NamespaceOverviewItem.QuotaSummary>> quotasByNs = new HashMap<>();
        try {
            for (V1ResourceQuota quota : coreV1Api.listResourceQuotaForAllNamespaces().execute().getItems()) {
                String ns = quota.getMetadata() != null ? quota.getMetadata().getNamespace() : null;
                if (ns != null) {
                    quotasByNs.computeIfAbsent(ns, k -> new ArrayList<>()).add(mapQuota(quota));
                }
            }
        } catch (ApiException ignored) {
            // ResourceQuotas may not exist in local cluster
        }

        List<NamespaceOverviewItem> items = new ArrayList<>();
        for (V1Namespace nsObj : nsList.getItems()) {
            String nsName = nsObj.getMetadata() != null ? nsObj.getMetadata().getName() : "Unknown";
            String status = nsObj.getStatus() != null && nsObj.getStatus().getPhase() != null
                    ? nsObj.getStatus().getPhase() : "Unknown";
            String createdAt = nsObj.getMetadata() != null && nsObj.getMetadata().getCreationTimestamp() != null
                    ? nsObj.getMetadata().getCreationTimestamp().toString() : null;

            int podCount = (int) allPods.stream().filter(p -> nsName.equals(p.namespace())).count();
            int depCount = (int) allDeployments.stream().filter(d -> nsName.equals(d.namespace())).count();
            int svcCount = (int) allServices.stream().filter(s -> nsName.equals(s.namespace())).count();

            items.add(new NamespaceOverviewItem(
                    nsName,
                    status,
                    createdAt,
                    podCount,
                    depCount,
                    svcCount,
                    quotasByNs.getOrDefault(nsName, List.of())
            ));
        }
        return items;
    }

    public WorkloadOperationResponse deleteNamespace(String namespace) throws ApiException {
        String nsName = namespace != null ? namespace.trim() : null;
        if (nsName == null || nsName.isBlank()) {
            auditService.record(
                    "DELETE_NAMESPACE",
                    "Namespace",
                    String.valueOf(namespace),
                    namespace,
                    "REJECTED",
                    "Validate namespace name",
                    "Namespace name must not be empty"
            );
            throw new IllegalArgumentException("Namespace name must not be empty");
        }

        try {
            V1Namespace existing = coreV1Api.readNamespace(nsName).execute();
            String currentPhase = existing.getStatus() != null && existing.getStatus().getPhase() != null
                    ? existing.getStatus().getPhase()
                    : "Active";

            coreV1Api.deleteNamespace(nsName).execute();

            String status = "Terminating".equalsIgnoreCase(currentPhase) ? "TERMINATING" : "ACCEPTED";
            String message = "Namespace \"" + nsName + "\" deletion request accepted (previous phase: "
                    + currentPhase + "). Associated namespaced resources will be garbage-collected asynchronously.";

            OperationAuditRecord audit = auditService.record(
                    "DELETE_NAMESPACE",
                    "Namespace",
                    nsName,
                    nsName,
                    status,
                    "previousPhase=" + currentPhase,
                    message
            );

            return new WorkloadOperationResponse(
                    "DELETE_NAMESPACE",
                    "Namespace",
                    nsName,
                    nsName,
                    status,
                    message,
                    null,
                    null,
                    null,
                    null,
                    audit.timestamp()
            );
        } catch (ApiException e) {
            String auditStatus = e.getCode() == 404 ? "NOT_FOUND" : "FAILED";
            auditService.record(
                    "DELETE_NAMESPACE",
                    "Namespace",
                    nsName,
                    nsName,
                    auditStatus,
                    "deleteNamespace",
                    "Kubernetes API error (" + e.getCode() + "): " + e.getMessage()
            );
            throw e;
        }
    }

    public NamespaceDetailResponse getNamespaceDetails(String namespace) throws ApiException {
        validateNamespaceName(namespace, "NS_INSPECT");

        V1Namespace nsObj = coreV1Api.readNamespace(namespace).execute();
        String status = nsObj.getStatus() != null && nsObj.getStatus().getPhase() != null
                ? nsObj.getStatus().getPhase() : "Unknown";
        String createdAt = nsObj.getMetadata() != null && nsObj.getMetadata().getCreationTimestamp() != null
                ? nsObj.getMetadata().getCreationTimestamp().toString() : null;
        Map<String, String> labels = nsObj.getMetadata() != null && nsObj.getMetadata().getLabels() != null
                ? Map.copyOf(nsObj.getMetadata().getLabels()) : Map.of();

        List<PodResponse> pods = podDiscoveryService.getPodsByNamespace(namespace);
        List<DeploymentResponse> deployments = resourceDiscoveryService.getDeployments(namespace);
        List<StatefulSetResponse> statefulSets = resourceDiscoveryService.getStatefulSets(namespace);
        List<ServiceResponse> services = resourceDiscoveryService.getServices(namespace);

        List<NamespaceDetailResponse.DaemonSetSummary> daemonSets = new ArrayList<>();
        try {
            for (V1DaemonSet ds : appsV1Api.listNamespacedDaemonSet(namespace).execute().getItems()) {
                daemonSets.add(new NamespaceDetailResponse.DaemonSetSummary(
                        ds.getMetadata() != null ? ds.getMetadata().getName() : "unknown",
                        ds.getStatus() != null && ds.getStatus().getDesiredNumberScheduled() != null ? ds.getStatus().getDesiredNumberScheduled() : 0,
                        ds.getStatus() != null && ds.getStatus().getCurrentNumberScheduled() != null ? ds.getStatus().getCurrentNumberScheduled() : 0,
                        ds.getStatus() != null && ds.getStatus().getNumberReady() != null ? ds.getStatus().getNumberReady() : 0
                ));
            }
        } catch (ApiException ignored) {
        }

        List<NamespaceDetailResponse.ConfigMapSummary> configMaps = new ArrayList<>();
        try {
            for (V1ConfigMap cm : coreV1Api.listNamespacedConfigMap(namespace).execute().getItems()) {
                configMaps.add(new NamespaceDetailResponse.ConfigMapSummary(
                        cm.getMetadata() != null ? cm.getMetadata().getName() : "unknown",
                        cm.getData() != null ? cm.getData().size() : 0,
                        cm.getMetadata() != null && cm.getMetadata().getCreationTimestamp() != null
                                ? cm.getMetadata().getCreationTimestamp().toString() : null
                ));
            }
        } catch (ApiException ignored) {
        }

        // Metadata only — never expose secret values
        List<NamespaceDetailResponse.SecretMetadataSummary> secretsMeta = new ArrayList<>();
        try {
            for (V1Secret sec : coreV1Api.listNamespacedSecret(namespace).execute().getItems()) {
                secretsMeta.add(new NamespaceDetailResponse.SecretMetadataSummary(
                        sec.getMetadata() != null ? sec.getMetadata().getName() : "unknown",
                        sec.getType(),
                        sec.getData() != null ? sec.getData().size() : 0,
                        sec.getMetadata() != null && sec.getMetadata().getCreationTimestamp() != null
                                ? sec.getMetadata().getCreationTimestamp().toString() : null
                ));
            }
        } catch (ApiException ignored) {
        }

        List<NamespaceOverviewItem.QuotaSummary> quotas = new ArrayList<>();
        try {
            for (V1ResourceQuota q : coreV1Api.listNamespacedResourceQuota(namespace).execute().getItems()) {
                quotas.add(mapQuota(q));
            }
        } catch (ApiException ignored) {
        }

        List<NamespaceDetailResponse.LimitRangeSummary> limitRanges = new ArrayList<>();
        try {
            for (V1LimitRange lr : coreV1Api.listNamespacedLimitRange(namespace).execute().getItems()) {
                int itemCount = lr.getSpec() != null && lr.getSpec().getLimits() != null ? lr.getSpec().getLimits().size() : 0;
                limitRanges.add(new NamespaceDetailResponse.LimitRangeSummary(
                        lr.getMetadata() != null ? lr.getMetadata().getName() : "unknown",
                        itemCount
                ));
            }
        } catch (ApiException ignored) {
        }

        List<NodeDetailResponse.NodeEventItem> events = new ArrayList<>();
        try {
            for (CoreV1Event ev : coreV1Api.listNamespacedEvent(namespace).execute().getItems()) {
                String time = ev.getEventTime() != null
                        ? ev.getEventTime().toString()
                        : ev.getLastTimestamp() != null
                        ? ev.getLastTimestamp().toString()
                        : ev.getFirstTimestamp() != null
                        ? ev.getFirstTimestamp().toString()
                        : null;
                events.add(new NodeDetailResponse.NodeEventItem(
                        ev.getReason(),
                        ev.getType(),
                        ev.getMessage(),
                        ev.getSource() != null ? ev.getSource().getComponent() : ev.getReportingComponent(),
                        time
                ));
            }
            events.sort(Comparator.comparing(
                    NodeDetailResponse.NodeEventItem::eventTime,
                    Comparator.nullsLast(Comparator.reverseOrder())
            ));
        } catch (ApiException ignored) {
        }

        return new NamespaceDetailResponse(
                namespace,
                status,
                createdAt,
                labels,
                pods,
                deployments,
                statefulSets,
                daemonSets,
                services,
                configMaps,
                secretsMeta,
                quotas,
                limitRanges,
                events
        );
    }

    public WorkloadOperationResponse createNamespace(CreateNamespaceRequest request) throws ApiException {
        String nsName = request != null && request.name() != null ? request.name().trim() : null;
        if (nsName == null || nsName.isBlank() || nsName.length() > 63 || !DNS_LABEL_PATTERN.matcher(nsName).matches()) {
            auditService.record(
                    "CREATE_NAMESPACE",
                    "Namespace",
                    String.valueOf(nsName),
                    nsName,
                    "REJECTED",
                    "Validate RFC 1123 DNS label",
                    "Invalid namespace name. Must be 1-63 lowercase alphanumeric characters or '-', starting and ending with alphanumeric."
            );
            throw new IllegalArgumentException(
                    "Invalid namespace name. Must be 1-63 lowercase alphanumeric characters or '-', starting and ending with alphanumeric."
            );
        }

        Map<String, String> safeLabels = new HashMap<>();
        if (request.labels() != null) {
            for (Map.Entry<String, String> entry : request.labels().entrySet()) {
                if (entry.getKey() != null && !entry.getKey().isBlank()) {
                    safeLabels.put(entry.getKey().trim(), entry.getValue() != null ? entry.getValue().trim() : "");
                }
            }
        }

        V1Namespace nsBody = new V1Namespace()
                .metadata(new V1ObjectMeta()
                        .name(nsName)
                        .labels(safeLabels.isEmpty() ? null : safeLabels));

        try {
            coreV1Api.createNamespace(nsBody).execute();
            String msg = "Namespace \"" + nsName + "\" creation request accepted.";
            OperationAuditRecord audit = auditService.record(
                    "CREATE_NAMESPACE",
                    "Namespace",
                    nsName,
                    nsName,
                    "ACCEPTED",
                    "labels=" + safeLabels,
                    msg
            );

            return new WorkloadOperationResponse(
                    "CREATE_NAMESPACE",
                    "Namespace",
                    nsName,
                    nsName,
                    "ACCEPTED",
                    msg,
                    null,
                    null,
                    null,
                    null,
                    audit.timestamp()
            );
        } catch (ApiException e) {
            auditService.record(
                    "CREATE_NAMESPACE",
                    "Namespace",
                    nsName,
                    nsName,
                    "FAILED",
                    "labels=" + safeLabels,
                    "Kubernetes API error (" + e.getCode() + "): " + e.getMessage()
            );
            throw e;
        }
    }

    private NamespaceOverviewItem.QuotaSummary mapQuota(V1ResourceQuota quota) {
        Map<String, String> hard = new HashMap<>();
        Map<String, String> used = new HashMap<>();
        if (quota.getStatus() != null) {
            if (quota.getStatus().getHard() != null) {
                for (Map.Entry<String, Quantity> e : quota.getStatus().getHard().entrySet()) {
                    hard.put(e.getKey(), e.getValue().toSuffixedString());
                }
            }
            if (quota.getStatus().getUsed() != null) {
                for (Map.Entry<String, Quantity> e : quota.getStatus().getUsed().entrySet()) {
                    used.put(e.getKey(), e.getValue().toSuffixedString());
                }
            }
        }
        return new NamespaceOverviewItem.QuotaSummary(
                quota.getMetadata() != null ? quota.getMetadata().getName() : "quota",
                hard,
                used
        );
    }

    private void validateNamespaceName(String namespace, String operation) {
        if (namespace == null || namespace.isBlank()) {
            auditService.record(operation, "Namespace", String.valueOf(namespace), namespace, "REJECTED", "Validate namespace", "Namespace must not be empty");
            throw new IllegalArgumentException("Namespace must not be empty");
        }
    }
}