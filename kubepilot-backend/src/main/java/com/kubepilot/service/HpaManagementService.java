package com.kubepilot.service;

import com.kubepilot.dto.HpaResponse;
import com.kubepilot.dto.HpaUpsertRequest;
import com.kubepilot.dto.WorkloadOperationResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AutoscalingV2Api;
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
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class HpaManagementService {

    private static final int MIN_ALLOWED_REPLICAS = 1;
    private static final int MAX_ALLOWED_REPLICAS = 50;

    private final AutoscalingV2Api autoscalingApi;
    private final OperationAuditService auditService;

    public HpaManagementService(ApiClient apiClient, OperationAuditService auditService) {
        this.autoscalingApi = new AutoscalingV2Api(apiClient);
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
        validateUpsertRequest(req, "CREATE_HPA");

        String ns = req.namespace().trim();
        String name = req.name().trim();
        V2HorizontalPodAutoscaler hpa = buildHpaModel(ns, name, req);

        try {
            autoscalingApi.createNamespacedHorizontalPodAutoscaler(ns, hpa).execute();
            String msg = "HPA \"" + name + "\" created for " + req.targetKind().trim()
                    + "/" + req.targetName().trim() + " (" + req.minReplicas() + "-" + req.maxReplicas() + " replicas).";
            auditService.record("CREATE_HPA", "HorizontalPodAutoscaler", name, ns, "ACCEPTED",
                    "target=" + req.targetKind() + "/" + req.targetName() + ", replicas=" + req.minReplicas() + ".." + req.maxReplicas(),
                    msg);

            return new WorkloadOperationResponse(
                    "CREATE_HPA", "HorizontalPodAutoscaler", name, ns, "ACCEPTED",
                    msg, req.minReplicas(), null, req.targetKind().trim(), req.targetName().trim(), Instant.now()
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

        HpaUpsertRequest normalized = new HpaUpsertRequest(
                name.trim(),
                namespace.trim(),
                req != null ? req.targetKind() : null,
                req != null ? req.targetName() : null,
                req != null ? req.minReplicas() : null,
                req != null ? req.maxReplicas() : null,
                req != null ? req.metricName() : null,
                req != null ? req.targetUtilizationPercent() : null
        );
        validateUpsertRequest(normalized, "UPDATE_HPA");

        String ns = namespace.trim();
        String hpaName = name.trim();

        try {
            V2HorizontalPodAutoscaler existing = autoscalingApi.readNamespacedHorizontalPodAutoscaler(hpaName, ns).execute();
            V2HorizontalPodAutoscaler updated = buildHpaModel(ns, hpaName, normalized);
            if (existing.getMetadata() != null && existing.getMetadata().getResourceVersion() != null) {
                updated.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
            }

            autoscalingApi.replaceNamespacedHorizontalPodAutoscaler(hpaName, ns, updated).execute();
            String msg = "HPA \"" + hpaName + "\" updated (" + normalized.minReplicas()
                    + "-" + normalized.maxReplicas() + " replicas, target " + normalized.targetUtilizationPercent() + "%).";
            auditService.record("UPDATE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "ACCEPTED",
                    "replicas=" + normalized.minReplicas() + ".." + normalized.maxReplicas() + ", util=" + normalized.targetUtilizationPercent() + "%",
                    msg);

            return new WorkloadOperationResponse(
                    "UPDATE_HPA", "HorizontalPodAutoscaler", hpaName, ns, "ACCEPTED",
                    msg, normalized.minReplicas(), null, normalized.targetKind().trim(), normalized.targetName().trim(), Instant.now()
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

    private void validateUpsertRequest(HpaUpsertRequest req, String operation) {
        if (req == null) {
            auditService.record(operation, "HorizontalPodAutoscaler", "unknown", null, "REJECTED", "null request", "HPA request must not be empty");
            throw new IllegalArgumentException("HPA request must not be empty");
        }
        validateNotBlank(req.namespace(), operation, req.name(), "Namespace must not be empty");
        validateNotBlank(req.name(), operation, req.name(), "HPA name must not be empty");
        validateNotBlank(req.targetName(), operation, req.name(), "Target workload name must not be empty");

        String kind = req.targetKind() != null ? req.targetKind().trim() : "";
        if (!"Deployment".equals(kind) && !"StatefulSet".equals(kind)) {
            auditService.record(operation, "HorizontalPodAutoscaler", req.name(), req.namespace(), "REJECTED", "kind=" + kind,
                    "Target kind must be Deployment or StatefulSet");
            throw new IllegalArgumentException("Target kind must be Deployment or StatefulSet");
        }

        Integer min = req.minReplicas();
        Integer max = req.maxReplicas();
        if (min == null || max == null || min < MIN_ALLOWED_REPLICAS || max > MAX_ALLOWED_REPLICAS || min > max) {
            auditService.record(operation, "HorizontalPodAutoscaler", req.name(), req.namespace(), "REJECTED",
                    "min=" + min + ", max=" + max,
                    "Replicas must satisfy 1 <= minReplicas <= maxReplicas <= " + MAX_ALLOWED_REPLICAS);
            throw new IllegalArgumentException("Replicas must satisfy 1 <= minReplicas <= maxReplicas <= " + MAX_ALLOWED_REPLICAS);
        }

        String metric = req.metricName() != null ? req.metricName().trim().toLowerCase(Locale.ROOT) : "";
        if (!"cpu".equals(metric) && !"memory".equals(metric)) {
            auditService.record(operation, "HorizontalPodAutoscaler", req.name(), req.namespace(), "REJECTED", "metric=" + metric,
                    "Metric name must be cpu or memory");
            throw new IllegalArgumentException("Metric name must be cpu or memory");
        }

        Integer util = req.targetUtilizationPercent();
        if (util == null || util < 1 || util > 100) {
            auditService.record(operation, "HorizontalPodAutoscaler", req.name(), req.namespace(), "REJECTED", "util=" + util,
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