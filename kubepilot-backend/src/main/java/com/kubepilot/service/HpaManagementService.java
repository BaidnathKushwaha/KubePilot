package com.kubepilot.service;

import com.kubepilot.dto.HpaResponse;
import com.kubepilot.dto.HpaUpsertRequest;
import com.kubepilot.dto.WorkloadOperationResponse;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.AutoscalingV2Api;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1Deployment;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1ResourceRequirements;
import io.kubernetes.client.openapi.models.V1StatefulSet;
import io.kubernetes.client.openapi.models.V2CrossVersionObjectReference;
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscaler;
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscalerCondition;
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscalerList;
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscalerSpec;
import io.kubernetes.client.openapi.models.V2HorizontalPodAutoscalerStatus;
import io.kubernetes.client.openapi.models.V2MetricSpec;
import io.kubernetes.client.openapi.models.V2MetricStatus;
import io.kubernetes.client.openapi.models.V2MetricTarget;
import io.kubernetes.client.openapi.models.V2ResourceMetricSource;
import io.kubernetes.client.openapi.models.V2ResourceMetricStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class HpaManagementService {

    private static final int MIN_ALLOWED_REPLICAS = 1;
    private static final int MAX_ALLOWED_REPLICAS = 50;

    private final AutoscalingV2Api autoscalingApi;
    private final AppsV1Api appsV1Api;
    private final OperationAuditService auditService;

    public HpaManagementService(ApiClient apiClient, OperationAuditService auditService) {
        this.autoscalingApi = new AutoscalingV2Api(apiClient);
        this.appsV1Api = new AppsV1Api(apiClient);
        this.auditService = auditService;
    }

    public List<HpaResponse> listHpas(String namespace) throws ApiException {
        V2HorizontalPodAutoscalerList list = (namespace != null && !namespace.isBlank())
                ? autoscalingApi.listNamespacedHorizontalPodAutoscaler(namespace.trim()).execute()
                : autoscalingApi.listHorizontalPodAutoscalerForAllNamespaces().execute();

        return list.getItems().stream()
                .map(this::mapHpa)
                .toList();
    }

    public WorkloadOperationResponse createHpa(HpaUpsertRequest req) throws ApiException {
        validateUpsertRequest(req, "CREATE_HPA", null);

        String ns = req.namespace().trim();
        String name = req.name().trim();
        String kind = req.targetKind().trim();
        String targetName = req.targetName().trim();
        String metric = req.metricName().trim().toLowerCase(Locale.ROOT);

        List<String> advisories = validateTargetAndInspectResources(ns, kind, targetName, metric, "CREATE_HPA", name);
        V2HorizontalPodAutoscaler hpa = buildHpaModel(ns, name, req);

        try {
            autoscalingApi.createNamespacedHorizontalPodAutoscaler(ns, hpa).execute();
            String msg = appendAdvisories(
                    "HPA \"" + name + "\" created for " + kind + "/" + targetName
                            + " (" + req.minReplicas() + "-" + req.maxReplicas() + " replicas).",
                    advisories
            );
            auditService.record("CREATE_HPA", "HorizontalPodAutoscaler", name, ns, "ACCEPTED",
                    "target=" + kind + "/" + targetName + ", replicas=" + req.minReplicas() + ".." + req.maxReplicas()
                            + ", advisories=" + String.join(" | ", advisories),
                    msg);

            return new WorkloadOperationResponse(
                    "CREATE_HPA", "HorizontalPodAutoscaler", name, ns, "ACCEPTED",
                    msg, req.minReplicas(), null, kind, targetName, Instant.now()
            );
        } catch (ApiException e) {
            auditService.record("CREATE_HPA", "HorizontalPodAutoscaler", name, ns, "FAILED",
                    "createNamespacedHorizontalPodAutoscaler", "Kubernetes API error (" + e.getCode() + "): " + e.getMessage());
            throw e;
        }
    }

    public WorkloadOperationResponse updateHpa(String namespace, String name, HpaUpsertRequest req) throws ApiException {
        validateNotBlank(namespace, "UPDATE_HPA", name, "Namespace must not be empty");
        validateNotBlank(name, "UPDATE_HPA", name, "HPA name must not be empty");

        String ns = namespace.trim();
        String hpaName = name.trim();

        HpaUpsertRequest normalized = new HpaUpsertRequest(
                hpaName,
                ns,
                req != null ? req.targetKind() : null,
                req != null ? req.targetName() : null,
                req != null ? req.minReplicas() : null,
                req != null ? req.maxReplicas() : null,
                req != null ? req.metricName() : null,
                req != null ? req.targetUtilizationPercent() : null
        );
        validateUpsertRequest(normalized, "UPDATE_HPA", hpaName);

        String kind = normalized.targetKind().trim();
        String targetName = normalized.targetName().trim();
        String metric = normalized.metricName().trim().toLowerCase(Locale.ROOT);
        List<String> advisories = validateTargetAndInspectResources(ns, kind, targetName, metric, "UPDATE_HPA", hpaName);

        try {
            V2HorizontalPodAutoscaler existing = autoscalingApi.readNamespacedHorizontalPodAutoscaler(hpaName, ns).execute();
            V2HorizontalPodAutoscaler updated = buildHpaModel(ns, hpaName, normalized);
            if (existing.getMetadata() != null && existing.getMetadata().getResourceVersion() != null) {
                updated.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            }

            autoscalingApi.replaceNamespacedHorizontalPodAutoscaler(hpaName, ns, updated).execute();
            String msg = appendAdvisories(
                    "HPA \"" + hpaName + "\" updated (" + normalized.minReplicas()
                            + "-" + normalized.maxReplicas() + " replicas, target " + normalized.targetUtilizationPercent() + "%).",
                    advisories
            );
            auditService.record("UPDATE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "ACCEPTED",
                    "replicas=" + normalized.minReplicas() + ".." + normalized.maxReplicas()
                            + ", util=" + normalized.targetUtilizationPercent() + "%, advisories=" + String.join(" | ", advisories),
                    msg);

            return new WorkloadOperationResponse(
                    "UPDATE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "ACCEPTED",
                    msg, normalized.minReplicas(), null, kind, targetName, Instant.now()
            );
        } catch (ApiException e) {
            auditService.record("UPDATE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "FAILED",
                    "replaceNamespacedHorizontalPodAutoscaler", "Kubernetes API error (" + e.getCode() + "): " + e.getMessage());
            throw e;
        }
    }

    public WorkloadOperationResponse deleteHpa(String namespace, String name) throws ApiException {
        validateNotBlank(namespace, "DELETE_HPA", name, "Namespace must not be empty");
        validateNotBlank(name, "DELETE_HPA", name, "HPA name must not be empty");

        String ns = namespace.trim();
        String hpaName = name.trim();

        try {
            autoscalingApi.deleteNamespacedHorizontalPodAutoscaler(hpaName, ns).execute();
            String msg = "HPA \"" + hpaName + "\" deletion request accepted.";
            auditService.record("DELETE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "ACCEPTED",
                    "deleteNamespacedHorizontalPodAutoscaler", msg);

            return new WorkloadOperationResponse(
                    "DELETE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "ACCEPTED",
                    msg, null, null, null, null, Instant.now()
            );
        } catch (ApiException e) {
            auditService.record("DELETE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "FAILED",
                    "deleteNamespacedHorizontalPodAutoscaler", "Kubernetes API error (" + e.getCode() + "): " + e.getMessage());
            throw e;
        }
    }

    private List<String> validateTargetAndInspectResources(
            String namespace,
            String kind,
            String targetName,
            String metric,
            String operation,
            String hpaName
    ) throws ApiException {
        List<V1Container> containers;
        try {
            if ("Deployment".equals(kind)) {
                V1Deployment dep = appsV1Api.readNamespacedDeployment(targetName, namespace).execute();
                containers = (dep.getSpec() != null && dep.getSpec().getTemplate() != null
                        && dep.getSpec().getTemplate().getSpec() != null
                        && dep.getSpec().getTemplate().getSpec().getContainers() != null)
                        ? dep.getSpec().getTemplate().getSpec().getContainers()
                        : List.of();
            } else {
                V1StatefulSet sts = appsV1Api.readNamespacedStatefulSet(targetName, namespace).execute();
                containers = (sts.getSpec() != null && sts.getSpec().getTemplate() != null
                        && sts.getSpec().getTemplate().getSpec() != null
                        && sts.getSpec().getTemplate().getSpec().getContainers() != null)
                        ? sts.getSpec().getTemplate().getSpec().getContainers()
                        : List.of();
            }
        } catch (ApiException e) {
            if (e.getCode() == 404) {
                String missingMsg = "Target " + kind + " \"" + targetName + "\" was not found in namespace \"" + namespace + "\".";
                auditService.record(operation, "HorizontalPodAutoscaler", hpaName, namespace, "REJECTED",
                        "target=" + kind + "/" + targetName + " (not found)", missingMsg);
                throw new IllegalArgumentException(missingMsg, e);
            }
            throw e;
        }

        boolean anyContainerHasRequest = false;
        boolean anyContainerHasLimit = false;

        for (V1Container c : containers) {
            V1ResourceRequirements res = c.getResources();
            if (res == null) {
                continue;
            }
            if (hasResourceQuantity(res.getRequests(), metric)) {
                anyContainerHasRequest = true;
            }
            if (hasResourceQuantity(res.getLimits(), metric)) {
                anyContainerHasLimit = true;
            }
        }

        List<String> advisories = new ArrayList<>();
        if (!anyContainerHasRequest) {
            advisories.add("Warning: Target " + kind + " \"" + targetName
                    + "\" defines no " + metric + " resource requests; utilization-based HPA scaling may not function correctly without "
                    + metric + " requests.");
        }
        if (!anyContainerHasLimit) {
            advisories.add("Info: Target " + kind + " \"" + targetName
                    + "\" defines no " + metric + " resource limits (informational only; HPA creation is not blocked).");
        }
        return advisories;
    }

    private boolean hasResourceQuantity(Map<String, Quantity> map, String metric) {
        if (map == null || map.isEmpty()) {
            return false;
        }
        Quantity q = map.get(metric);
        return q != null && q.getNumber() != null && q.getNumber().signum() > 0;
    }

    private String appendAdvisories(String baseMessage, List<String> advisories) {
        if (advisories == null || advisories.isEmpty()) {
            return baseMessage;
        }
        return baseMessage + " " + String.join(" ", advisories);
    }

    private V2HorizontalPodAutoscaler buildHpaModel(String namespace, String name, HpaUpsertRequest req) {
        String kind = req.targetKind().trim();
        String targetName = req.targetName().trim();
        String metric = req.metricName().trim().toLowerCase(Locale.ROOT);
        int targetUtil = req.targetUtilizationPercent();

        V2CrossVersionObjectReference scaleTargetRef = new V2CrossVersionObjectReference()
                .apiVersion("apps/v1")
                .kind(kind)
                .name(targetName);

        V2MetricSpec metricSpec = new V2MetricSpec()
                .type("Resource")
                .resource(new V2ResourceMetricSource()
                        .name(metric)
                        .target(new V2MetricTarget()
                                .type("Utilization")
                                .averageUtilization(targetUtil)));

        V2HorizontalPodAutoscalerSpec spec = new V2HorizontalPodAutoscalerSpec()
                .scaleTargetRef(scaleTargetRef)
                .minReplicas(req.minReplicas())
                .maxReplicas(req.maxReplicas())
                .metrics(List.of(metricSpec));

        return new V2HorizontalPodAutoscaler()
                .apiVersion("autoscaling/v2")
                .kind("HorizontalPodAutoscaler")
                .metadata(new V1ObjectMeta().name(name).namespace(namespace))
                .spec(spec);
    }

    private HpaResponse mapHpa(V2HorizontalPodAutoscaler hpa) {
        V1ObjectMeta meta = hpa.getMetadata();
        V2HorizontalPodAutoscalerSpec spec = hpa.getSpec();
        V2HorizontalPodAutoscalerStatus status = hpa.getStatus();

        String name = meta != null ? meta.getName() : "Unknown";
        String ns = meta != null ? meta.getNamespace() : "Unknown";

        V2CrossVersionObjectReference ref = spec != null ? spec.getScaleTargetRef() : null;
        String targetKind = ref != null ? ref.getKind() : "Deployment";
        String targetName = ref != null ? ref.getName() : "Unknown";
        String targetApiVersion = ref != null ? ref.getApiVersion() : "apps/v1";

        int minReplicas = spec != null && spec.getMinReplicas() != null ? spec.getMinReplicas() : 1;
        int maxReplicas = spec != null ? spec.getMaxReplicas() : 1;
        int currentReplicas = status != null && status.getCurrentReplicas() != null ? status.getCurrentReplicas() : 0;
        int desiredReplicas = status != null ? status.getDesiredReplicas() : minReplicas;

        String metricName = "cpu";
        Integer targetUtilization = null;
        if (spec != null && spec.getMetrics() != null && !spec.getMetrics().isEmpty()) {
            V2MetricSpec first = spec.getMetrics().get(0);
            if (first.getResource() != null) {
                metricName = first.getResource().getName() != null ? first.getResource().getName() : "cpu";
                if (first.getResource().getTarget() != null) {
                    targetUtilization = first.getResource().getTarget().getAverageUtilization();
                }
            }
        }

        Integer currentUtilization = null;
        if (status != null && status.getCurrentMetrics() != null) {
            for (V2MetricStatus ms : status.getCurrentMetrics()) {
                V2ResourceMetricStatus resStatus = ms.getResource();
                if (resStatus != null && metricName.equalsIgnoreCase(resStatus.getName())
                        && resStatus.getCurrent() != null) {
                    currentUtilization = resStatus.getCurrent().getAverageUtilization();
                    break;
                }
            }
        }

        String lastScaleTime = status != null && status.getLastScaleTime() != null
                ? status.getLastScaleTime().toString()
                : null;

        List<HpaResponse.HpaConditionItem> conds = new ArrayList<>();
        if (status != null && status.getConditions() != null) {
            for (V2HorizontalPodAutoscalerCondition c : status.getConditions()) {
                conds.add(new HpaResponse.HpaConditionItem(
                        c.getType(),
                        c.getStatus(),
                        c.getReason(),
                        c.getMessage(),
                        c.getLastTransitionTime() != null ? c.getLastTransitionTime().toString() : null
                ));
            }
        }

        return new HpaResponse(
                name, ns, targetKind, targetName, targetApiVersion,
                minReplicas, maxReplicas, currentReplicas, desiredReplicas,
                metricName, targetUtilization, currentUtilization, lastScaleTime, conds
        );
    }

    private void validateUpsertRequest(HpaUpsertRequest req, String operation, String auditTargetName) {
        String loggedName = (auditTargetName != null && !auditTargetName.isBlank())
                ? auditTargetName
                : (req != null && req.name() != null && !req.name().isBlank() ? req.name().trim() : "unknown");
        String loggedNs = (req != null && req.namespace() != null && !req.namespace().isBlank()) ? req.namespace().trim() : null;

        if (req == null) {
            auditService.record(operation, "HorizontalPodAutoscaler", loggedName, loggedNs, "REJECTED", "null request", "HPA request must not be empty");
            throw new IllegalArgumentException("HPA request must not be empty");
        }
        validateNotBlank(req.namespace(), operation, loggedName, "Namespace must not be empty");
        validateNotBlank(req.name(), operation, loggedName, "HPA name must not be empty");
        validateNotBlank(req.targetName(), operation, loggedName, "Target workload name must not be empty");

        String kind = req.targetKind() != null ? req.targetKind().trim() : "";
        if (!"Deployment".equals(kind) && !"StatefulSet".equals(kind)) {
            auditService.record(operation, "HorizontalPodAutoscaler", loggedName, loggedNs, "REJECTED", "kind=" + kind,
                    "Target kind must be Deployment or StatefulSet");
            throw new IllegalArgumentException("Target kind must be Deployment or StatefulSet");
        }

        Integer min = req.minReplicas();
        Integer max = req.maxReplicas();
        if (min == null || max == null || min < MIN_ALLOWED_REPLICAS || max > MAX_ALLOWED_REPLICAS || min > max) {
            auditService.record(operation, "HorizontalPodAutoscaler", loggedName, loggedNs, "REJECTED",
                    "min=" + min + ", max=" + max,
                    "Replicas must satisfy 1 <= minReplicas <= maxReplicas <= " + MAX_ALLOWED_REPLICAS);
            throw new IllegalArgumentException("Replicas must satisfy 1 <= minReplicas <= maxReplicas <= " + MAX_ALLOWED_REPLICAS);
        }

        String metric = req.metricName() != null ? req.metricName().trim().toLowerCase(Locale.ROOT) : "";
        if (!"cpu".equals(metric) && !"memory".equals(metric)) {
            auditService.record(operation, "HorizontalPodAutoscaler", loggedName, loggedNs, "REJECTED", "metric=" + metric,
                    "Metric name must be cpu or memory");
            throw new IllegalArgumentException("Metric name must be cpu or memory");
        }

        Integer util = req.targetUtilizationPercent();
        if (util == null || util < 1 || util > 100) {
            auditService.record(operation, "HorizontalPodAutoscaler", loggedName, loggedNs, "REJECTED", "util=" + util,
                    "Target utilization percent must be between 1 and 100");
            throw new IllegalArgumentException("Target utilization percent must be between 1 and 100");
        }
    }

    private void validateNotBlank(String value, String operation, String targetName, String message) {
        if (value == null || value.isBlank()) {
            auditService.record(operation, "HorizontalPodAutoscaler", String.valueOf(targetName), null, "REJECTED", "blank check", message);
            throw new IllegalArgumentException(message);
        }
    }
}