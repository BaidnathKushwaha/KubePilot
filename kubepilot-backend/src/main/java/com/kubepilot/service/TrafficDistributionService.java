package com.kubepilot.service;

import com.kubepilot.dto.DeploymentResponse;
import com.kubepilot.dto.EndpointResponse;
import com.kubepilot.dto.EndpointSliceResponse;
import com.kubepilot.dto.IngressResponse;
import com.kubepilot.dto.IngressRouteResponse;
import com.kubepilot.dto.PrometheusStatusResponse;
import com.kubepilot.dto.ServiceResponse;
import com.kubepilot.dto.ServiceTrafficResponse;
import com.kubepilot.dto.StatefulSetResponse;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class TrafficDistributionService {

    private final ResourceDiscoveryService resourceDiscoveryService;
    private final PrometheusMonitoringService prometheusMonitoringService;
    private final String prometheusUrl;

    public TrafficDistributionService(
            ResourceDiscoveryService resourceDiscoveryService,
            PrometheusMonitoringService prometheusMonitoringService,
            @Value("${kubepilot.monitoring.prometheus-url:}") String prometheusUrl) {
        this.resourceDiscoveryService = resourceDiscoveryService;
        this.prometheusMonitoringService = prometheusMonitoringService;
        this.prometheusUrl = prometheusUrl != null ? prometheusUrl.trim() : "";
    }

    public ServiceTrafficResponse getServiceDistribution(String namespace) throws ApiException {
        String nsFilter = (namespace != null && !namespace.isBlank()) ? namespace.trim() : null;

        List<ServiceResponse> services = resourceDiscoveryService.getServices(nsFilter);
        List<EndpointSliceResponse> slices = resourceDiscoveryService.getEndpointSlices(nsFilter);
        List<IngressResponse> ingresses = resourceDiscoveryService.getIngresses(nsFilter);
        List<DeploymentResponse> deployments = resourceDiscoveryService.getDeployments(nsFilter);
        List<StatefulSetResponse> statefulSets = resourceDiscoveryService.getStatefulSets(nsFilter);

        Map<String, Set<String>> hostsByServiceKey = indexIngressHostsByService(ingresses);
        Map<String, List<EndpointSliceResponse>> slicesByServiceKey = indexSlicesByService(slices);

        List<ServiceTrafficResponse.ServiceDistributionItem> items = new ArrayList<>();

        for (ServiceResponse svc : services) {
            String svcKey = svc.namespace() + "/" + svc.name();
            Set<String> hosts = hostsByServiceKey.getOrDefault(svcKey, Set.of());

            List<String> matchedWorkloads = new ArrayList<>();
            for (DeploymentResponse dep : deployments) {
                if (Objects.equals(svc.namespace(), dep.namespace())
                        && selectorsMatch(svc.selector(), dep.selector())) {
                    matchedWorkloads.add("Deployment/" + dep.name());
                }
            }
            for (StatefulSetResponse sts : statefulSets) {
                if (Objects.equals(svc.namespace(), sts.namespace())
                        && selectorsMatch(svc.selector(), sts.selector())) {
                    matchedWorkloads.add("StatefulSet/" + sts.name());
                }
            }

            List<ServiceTrafficResponse.EndpointTargetItem> endpoints = new ArrayList<>();
            int readyCount = 0;
            int unreadyCount = 0;

            for (EndpointSliceResponse slice : slicesByServiceKey.getOrDefault(svcKey, List.of())) {
                for (EndpointResponse ep : slice.endpoints()) {
                    boolean isReady = Boolean.TRUE.equals(ep.ready());
                    if (isReady) {
                        readyCount++;
                    } else {
                        unreadyCount++;
                    }
                    String addr = (ep.addresses() != null && !ep.addresses().isEmpty())
                            ? String.join(", ", ep.addresses())
                            : "none";
                    endpoints.add(new ServiceTrafficResponse.EndpointTargetItem(
                            addr,
                            isReady,
                            ep.targetRefKind(),
                            ep.targetRefName(),
                            slice.name(),
                            "Measured request rate unavailable: no application or ingress request-rate exporter queried"
                    ));
                }
            }

            items.add(new ServiceTrafficResponse.ServiceDistributionItem(
                    svc.name(),
                    svc.namespace(),
                    svc.type(),
                    svc.clusterIP(),
                    new ArrayList<>(hosts),
                    svc.ports(),
                    matchedWorkloads,
                    readyCount,
                    unreadyCount,
                    endpoints
            ));
        }

        boolean rateAvailable = false;
        String note = buildTelemetryNote();

        return new ServiceTrafficResponse(nsFilter, rateAvailable, note, items);
    }

    private String buildTelemetryNote() {
        String baseTopologyNote = "Primary source is live Kubernetes Services, Ingresses, EndpointSlices, and workload selectors (discovered routing topology, not measured request traffic). "
                + "Standard cAdvisor and kube-state-metrics metrics do not provide HTTP/gRPC request rates or latency; application instrumentation or ingress-controller exporters are required.";

        if (prometheusUrl.isEmpty() || prometheusMonitoringService == null) {
            return baseTopologyNote + " Prometheus is not configured.";
        }

        PrometheusStatusResponse status = prometheusMonitoringService.checkConnection();
        if (status != null && status.connected()) {
            return baseTopologyNote + " Supplementary Prometheus (" + prometheusUrl + ") is reachable (targets up: "
                    + status.resultCount() + "), but no HTTP/gRPC request-rate metric series are queried.";
        }

        return baseTopologyNote + " Supplementary Prometheus (" + prometheusUrl + ") is currently unreachable.";
    }

    private Map<String, Set<String>> indexIngressHostsByService(List<IngressResponse> ingresses) {
        Map<String, Set<String>> map = new HashMap<>();
        for (IngressResponse ing : ingresses) {
            if (ing.namespace() == null || ing.routes() == null) {
                continue;
            }
            for (IngressRouteResponse route : ing.routes()) {
                if (route.serviceName() == null || route.serviceName().isBlank()) {
                    continue;
                }
                String key = ing.namespace() + "/" + route.serviceName();
                Set<String> hosts = map.computeIfAbsent(key, ignored -> new LinkedHashSet<>());
                if (route.host() != null && !route.host().isBlank()) {
                    hosts.add(route.host());
                } else if (ing.hosts() != null) {
                    hosts.addAll(ing.hosts());
                }
            }
        }
        return map;
    }

    private Map<String, List<EndpointSliceResponse>> indexSlicesByService(List<EndpointSliceResponse> slices) {
        Map<String, List<EndpointSliceResponse>> map = new HashMap<>();
        for (EndpointSliceResponse slice : slices) {
            if (slice.namespace() == null || slice.serviceName() == null || slice.serviceName().isBlank()) {
                continue;
            }
            String key = slice.namespace() + "/" + slice.serviceName();
            map.computeIfAbsent(key, ignored -> new ArrayList<>()).add(slice);
        }
        return map;
    }

    private boolean selectorsMatch(Map<String, String> svcSelector, Map<String, String> workloadSelector) {
        if (svcSelector == null || svcSelector.isEmpty() || workloadSelector == null || workloadSelector.isEmpty()) {
            return false;
        }
        for (Map.Entry<String, String> entry : svcSelector.entrySet()) {
            String wlVal = workloadSelector.get(entry.getKey());
            if (wlVal == null || !Objects.equals(entry.getValue(), wlVal)) {
                return false;
            }
        }
        return true;
    }
}