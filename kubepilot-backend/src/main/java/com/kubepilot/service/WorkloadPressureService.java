package com.kubepilot.service;

import com.kubepilot.dto.DeploymentResponse;
import com.kubepilot.dto.PodMetricsResponse;
import com.kubepilot.dto.PodResponse;
import com.kubepilot.dto.StatefulSetResponse;
import com.kubepilot.dto.WorkloadPressureResponse;
import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1ResourceRequirements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class WorkloadPressureService {

    private final CoreV1Api coreV1Api;
    private final PodDiscoveryService podDiscoveryService;
    private final ResourceDiscoveryService resourceDiscoveryService;
    private final MetricsDiscoveryService metricsDiscoveryService;

    private final double defaultCpuThreshold;
    private final double defaultMemoryThreshold;
    private final double defaultNearLimitPercent;
    private final String prometheusUrl;

    public WorkloadPressureService(
            ApiClient apiClient,
            PodDiscoveryService podDiscoveryService,
            ResourceDiscoveryService resourceDiscoveryService,
            MetricsDiscoveryService metricsDiscoveryService,
            @Value("${kubepilot.monitoring.cpu-overload-percent:80.0}") double defaultCpuThreshold,
            @Value("${kubepilot.monitoring.memory-overload-percent:80.0}") double defaultMemoryThreshold,
            @Value("${kubepilot.monitoring.near-limit-percent:85.0}") double defaultNearLimitPercent,
            @Value("${kubepilot.monitoring.prometheus-url:}") String prometheusUrl) {
        this.coreV1Api = new CoreV1Api(apiClient);
        this.podDiscoveryService = podDiscoveryService;
        this.resourceDiscoveryService = resourceDiscoveryService;
        this.metricsDiscoveryService = metricsDiscoveryService;
        this.defaultCpuThreshold = defaultCpuThreshold;
        this.defaultMemoryThreshold = defaultMemoryThreshold;
        this.defaultNearLimitPercent = defaultNearLimitPercent;
        this.prometheusUrl = prometheusUrl != null ? prometheusUrl.trim() : "";
    }

    public WorkloadPressureResponse evaluatePressure(
            String namespace,
            Double cpuThresholdOverride,
            Double memoryThresholdOverride,
            Double nearLimitOverride
    ) throws ApiException {
        double cpuThreshold = sanitizePercent(cpuThresholdOverride, defaultCpuThreshold);
        double memThreshold = sanitizePercent(memoryThresholdOverride, defaultMemoryThreshold);
        double nearLimit = sanitizePercent(nearLimitOverride, defaultNearLimitPercent);

        String nsFilter = (namespace != null && !namespace.isBlank()) ? namespace.trim() : null;

        List<PodResponse> pods = nsFilter != null
                ? podDiscoveryService.getPodsByNamespace(nsFilter)
                : podDiscoveryService.getPods();
        List<DeploymentResponse> deployments = resourceDiscoveryService.getDeployments(nsFilter);
        List<StatefulSetResponse> statefulSets = resourceDiscoveryService.getStatefulSets(nsFilter);

        Map<String, PodMetricsResponse> metricsByKey = new LinkedHashMap<>();
        boolean metricsServerAvailable = true;
        try {
            List<PodMetricsResponse> podMetrics = nsFilter != null
                    ? metricsDiscoveryService.getPodMetrics(nsFilter)
                    : metricsDiscoveryService.getAllPodMetrics();
            for (PodMetricsResponse pm : podMetrics) {
                metricsByKey.put(pm.namespace() + "/" + pm.name(), pm);
            }
        } catch (ApiException ex) {
            metricsServerAvailable = false;
        }

        Map<String, PodSpecResources> specResByKey = fetchPodSpecResources(nsFilter);

        List<WorkloadPressureResponse.WorkloadResourceItem> items = new ArrayList<>();
        Map<String, WorkloadPressureResponse.OverloadWarningItem> deduplicatedWarnings = new LinkedHashMap<>();

        for (DeploymentResponse dep : deployments) {
            List<PodResponse> matchingPods = pods.stream()
                    .filter(p -> Objects.equals(dep.namespace(), p.namespace()))
                    .filter(p -> matchesSelector(dep.selector(), p.labels()))
                    .toList();

            items.add(buildWorkloadItem(
                    "Deployment",
                    dep.name(),
                    dep.namespace(),
                    dep.desiredReplicas(),
                    dep.readyReplicas(),
                    matchingPods,
                    metricsByKey,
                    specResByKey,
                    cpuThreshold,
                    memThreshold,
                    nearLimit,
                    deduplicatedWarnings
            ));
        }

        for (StatefulSetResponse sts : statefulSets) {
            List<PodResponse> matchingPods = pods.stream()
                    .filter(p -> Objects.equals(sts.namespace(), p.namespace()))
                    .filter(p -> "StatefulSet".equals(p.ownerKind()) && Objects.equals(sts.name(), p.ownerName()))
                    .toList();

            items.add(buildWorkloadItem(
                    "StatefulSet",
                    sts.name(),
                    sts.namespace(),
                    sts.desiredReplicas(),
                    sts.readyReplicas(),
                    matchingPods,
                    metricsByKey,
                    specResByKey,
                    cpuThreshold,
                    memThreshold,
                    nearLimit,
                    deduplicatedWarnings
            ));
        }

        boolean trafficAvailable = !prometheusUrl.isEmpty();
        String trafficNote = trafficAvailable
                ? "Prometheus endpoint configured (" + prometheusUrl + "); live query telemetry integration is pending."
                : "Traffic metrics unavailable: no Prometheus/application traffic telemetry source is configured.";

        return new WorkloadPressureResponse(
                nsFilter,
                cpuThreshold,
                memThreshold,
                nearLimit,
                metricsServerAvailable,
                false,
                trafficNote,
                items,
                new ArrayList<>(deduplicatedWarnings.values())
        );
    }

    private WorkloadPressureResponse.WorkloadResourceItem buildWorkloadItem(
            String kind,
            String name,
            String ns,
            int desiredReplicas,
            int readyReplicas,
            List<PodResponse> matchingPods,
            Map<String, PodMetricsResponse> metricsByKey,
            Map<String, PodSpecResources> specResByKey,
            double cpuThreshold,
            double memThreshold,
            double nearLimit,
            Map<String, WorkloadPressureResponse.OverloadWarningItem> warningsMap
    ) {
        long cpuUsage = 0L;
        long memUsage = 0L;
        boolean anyPodHasMetrics = false;

        long cpuReqSum = 0L;
        long cpuLimSum = 0L;
        long memReqSum = 0L;
        long memLimSum = 0L;
        boolean hasCpuReq = false;
        boolean hasCpuLim = false;
        boolean hasMemReq = false;
        boolean hasMemLim = false;

        for (PodResponse pod : matchingPods) {
            String key = pod.namespace() + "/" + pod.name();
            PodMetricsResponse pm = metricsByKey.get(key);
            if (pm != null) {
                anyPodHasMetrics = true;
                cpuUsage += pm.cpuMilliCores();
                memUsage += pm.memoryBytes();
            }

            PodSpecResources specRes = specResByKey.get(key);
            if (specRes != null) {
                if (specRes.cpuRequestMilli != null) {
                    cpuReqSum += specRes.cpuRequestMilli;
                    hasCpuReq = true;
                }
                if (specRes.cpuLimitMilli != null) {
                    cpuLimSum += specRes.cpuLimitMilli;
                    hasCpuLim = true;
                }
                if (specRes.memoryRequestBytes != null) {
                    memReqSum += specRes.memoryRequestBytes;
                    hasMemReq = true;
                }
                if (specRes.memoryLimitBytes != null) {
                    memLimSum += specRes.memoryLimitBytes;
                    hasMemLim = true;
                }
            }
        }

        Long cpuReq = hasCpuReq ? cpuReqSum : null;
        Long cpuLim = hasCpuLim ? cpuLimSum : null;
        Long memReq = hasMemReq ? memReqSum : null;
        Long memLim = hasMemLim ? memLimSum : null;

        Double cpuPercent = null;
        if (anyPodHasMetrics) {
            Long cpuBasis = cpuLim != null && cpuLim > 0 ? cpuLim : (cpuReq != null && cpuReq > 0 ? cpuReq : null);
            if (cpuBasis != null) {
                cpuPercent = roundTwo((cpuUsage * 100.0) / cpuBasis);
            }
        }

        Double memPercent = null;
        if (anyPodHasMetrics) {
            Long memBasis = memLim != null && memLim > 0 ? memLim : (memReq != null && memReq > 0 ? memReq : null);
            if (memBasis != null) {
                memPercent = roundTwo((memUsage * 100.0) / memBasis);
            }
        }

        List<String> warningCodes = new ArrayList<>();
        String targetId = kind + ":" + ns + "/" + name;

        if (anyPodHasMetrics && cpuPercent != null) {
            if (cpuLim != null && cpuLim > 0 && cpuPercent >= nearLimit) {
                String code = "NEAR_CPU_LIMIT";
                warningCodes.add(code);
                String wKey = targetId + "|" + code;
                warningsMap.putIfAbsent(wKey, new WorkloadPressureResponse.OverloadWarningItem(
                        wKey,
                        code,
                        "HIGH",
                        kind,
                        name,
                        ns,
                        cpuPercent,
                        nearLimit,
                        kind + " " + ns + "/" + name + " CPU at " + cpuPercent + "% of limit (" + cpuUsage + "m / " + cpuLim + "m)."
                ));
            } else if (cpuPercent >= cpuThreshold) {
                String code = "HIGH_CPU";
                warningCodes.add(code);
                String wKey = targetId + "|" + code;
                warningsMap.putIfAbsent(wKey, new WorkloadPressureResponse.OverloadWarningItem(
                        wKey,
                        code,
                        "WARNING",
                        kind,
                        name,
                        ns,
                        cpuPercent,
                        cpuThreshold,
                        kind + " " + ns + "/" + name + " CPU usage at " + cpuPercent + "% (threshold " + cpuThreshold + "%)."
                ));
            }
        }

        if (anyPodHasMetrics && memPercent != null) {
            if (memLim != null && memLim > 0 && memPercent >= nearLimit) {
                String code = "NEAR_MEMORY_LIMIT";
                warningCodes.add(code);
                String wKey = targetId + "|" + code;
                warningsMap.putIfAbsent(wKey, new WorkloadPressureResponse.OverloadWarningItem(
                        wKey,
                        code,
                        "HIGH",
                        kind,
                        name,
                        ns,
                        memPercent,
                        nearLimit,
                        kind + " " + ns + "/" + name + " memory at " + memPercent + "% of limit."
                ));
            } else if (memPercent >= memThreshold) {
                String code = "HIGH_MEMORY";
                warningCodes.add(code);
                String wKey = targetId + "|" + code;
                warningsMap.putIfAbsent(wKey, new WorkloadPressureResponse.OverloadWarningItem(
                        wKey,
                        code,
                        "WARNING",
                        kind,
                        name,
                        ns,
                        memPercent,
                        memThreshold,
                        kind + " " + ns + "/" + name + " memory usage at " + memPercent + "% (threshold " + memThreshold + "%)."
                ));
            }
        }

        return new WorkloadPressureResponse.WorkloadResourceItem(
                kind,
                name,
                ns,
                desiredReplicas,
                readyReplicas,
                anyPodHasMetrics,
                anyPodHasMetrics ? cpuUsage : 0L,
                anyPodHasMetrics ? memUsage : 0L,
                cpuReq,
                cpuLim,
                memReq,
                memLim,
                cpuPercent,
                memPercent,
                !warningCodes.isEmpty(),
                warningCodes
        );
    }

    private Map<String, PodSpecResources> fetchPodSpecResources(String nsFilter) throws ApiException {
        List<V1Pod> v1Pods = nsFilter != null
                ? coreV1Api.listNamespacedPod(nsFilter).execute().getItems()
                : coreV1Api.listPodForAllNamespaces().execute().getItems();

        Map<String, PodSpecResources> map = new LinkedHashMap<>();
        for (V1Pod pod : v1Pods) {
            if (pod.getMetadata() == null || pod.getSpec() == null || pod.getSpec().getContainers() == null) {
                continue;
            }
            long cpuReq = 0L;
            long cpuLim = 0L;
            long memReq = 0L;
            long memLim = 0L;
            boolean hasCpuReq = false;
            boolean hasCpuLim = false;
            boolean hasMemReq = false;
            boolean hasMemLim = false;

            for (V1Container c : pod.getSpec().getContainers()) {
                V1ResourceRequirements res = c.getResources();
                if (res == null) {
                    continue;
                }
                if (res.getRequests() != null) {
                    Quantity qCpu = res.getRequests().get("cpu");
                    if (qCpu != null) {
                        cpuReq += parseCpuMilli(qCpu);
                        hasCpuReq = true;
                    }
                    Quantity qMem = res.getRequests().get("memory");
                    if (qMem != null) {
                        memReq += parseMemoryBytes(qMem);
                        hasMemReq = true;
                    }
                }
                if (res.getLimits() != null) {
                    Quantity qCpu = res.getLimits().get("cpu");
                    if (qCpu != null) {
                        cpuLim += parseCpuMilli(qCpu);
                        hasCpuLim = true;
                    }
                    Quantity qMem = res.getLimits().get("memory");
                    if (qMem != null) {
                        memLim += parseMemoryBytes(qMem);
                        hasMemLim = true;
                    }
                }
            }

            String key = pod.getMetadata().getNamespace() + "/" + pod.getMetadata().getName();
            map.put(key, new PodSpecResources(
                    hasCpuReq ? cpuReq : null,
                    hasCpuLim ? cpuLim : null,
                    hasMemReq ? memReq : null,
                    hasMemLim ? memLim : null
            ));
        }
        return map;
    }

    private long parseCpuMilli(Quantity quantity) {
        BigDecimal cores = quantity.getNumber();
        return cores.multiply(BigDecimal.valueOf(1000)).setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private long parseMemoryBytes(Quantity quantity) {
        return quantity.getNumber().setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private boolean matchesSelector(Map<String, String> selector, Map<String, String> labels) {
        if (selector == null || selector.isEmpty() || labels == null) {
            return false;
        }
        return selector.entrySet().stream()
                .allMatch(e -> Objects.equals(labels.get(e.getKey()), e.getValue()));
    }

    private double sanitizePercent(Double override, double fallback) {
        if (override == null || !Double.isFinite(override) || override <= 0.0 || override > 100.0) {
            return fallback;
        }
        return override;
    }

    private double roundTwo(double val) {
        return Math.round(val * 100.0) / 100.0;
    }

    private record PodSpecResources(
            Long cpuRequestMilli,
            Long cpuLimitMilli,
            Long memoryRequestBytes,
            Long memoryLimitBytes
    ) {
    }
}