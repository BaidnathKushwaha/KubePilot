package com.kubepilot.service;

import com.kubepilot.dto.DeploymentResponse;
import com.kubepilot.dto.EndpointResponse;
import com.kubepilot.dto.EndpointSliceResponse;
import com.kubepilot.dto.IngressResponse;
import com.kubepilot.dto.IngressRouteResponse;
import com.kubepilot.dto.ServiceResponse;
import com.kubepilot.dto.ServiceTrafficResponse;
import com.kubepilot.dto.StatefulSetResponse;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class TrafficDistributionService {

    private final ResourceDiscoveryService resourceDiscoveryService;
    private final String prometheusUrl;

    public TrafficDistributionService(
            ResourceDiscoveryService resourceDiscoveryService,
            @Value("${kubepilot.monitoring.prometheus-url:}") String prometheusUrl) {
        this.resourceDiscoveryService = resourceDiscoveryService;
        this.prometheusUrl = prometheusUrl != null ? prometheusUrl.trim() : "";
    }

    public ServiceTrafficResponse getServiceDistribution(String namespace) throws ApiException {
        String nsFilter = (namespace != null && !namespace.isBlank()) ? namespace.trim() : null;

        List<ServiceResponse> services = resourceDiscoveryService.getServices(nsFilter);
        List<EndpointSliceResponse> slices = resourceDiscoveryService.getEndpointSlices(nsFilter);
        List<IngressResponse> ingresses = resourceDiscoveryService.getIngresses(nsFilter);
        List<DeploymentResponse> deployments = resourceDiscoveryService.getDeployments(nsFilter);
        List<StatefulSetResponse> statefulSets = resourceDiscoveryService.getStatefulSets(nsFilter);

        List<ServiceTrafficResponse.ServiceDistributionItem> items = new ArrayList<>();

        for (ServiceResponse svc : services) {
            Set<String> hosts = new LinkedHashSet<>();
            for (IngressResponse ing : ingresses) {
                if (!Objects.equals(svc.namespace(), ing.namespace())) {
                    continue;
                }
                for (IngressRouteResponse route : ing.routes()) {
                    if (Objects.equals(svc.name(), route.serviceName())) {
                        if (route.host() != null && !route.host().isBlank()) {
                            hosts.add(route.host());
                        } else if (ing.hosts() != null) {
                            hosts.addAll(ing.hosts());
                        }
                    }
                }
            }

            List<String> matchedWorkloads = new ArrayList<>();
            for (DeploymentResponse dep : deployments) {
                if (Objects.equals(svc.namespace(), dep.namespace())
                        && selectorsOverlap(svc.selector(), dep.selector())) {
                    matchedWorkloads.add("Deployment/" + dep.name());
                }
            }
            for (StatefulSetResponse sts : statefulSets) {
                if (Objects.equals(svc.namespace(), sts.namespace())
                        && selectorsOverlap(svc.selector(), sts.selector())) {
                    matchedWorkloads.add("StatefulSet/" + sts.name());
                }
            }

            List<ServiceTrafficResponse.EndpointTargetItem> endpoints = new ArrayList<>();
            int readyCount = 0;
            int unreadyCount = 0;

            for (EndpointSliceResponse slice : slices) {
                if (!Objects.equals(svc.namespace(), slice.namespace())) {
                    continue;
                }
                if (!Objects.equals(svc.name(), slice.serviceName())) {
                    continue;
                }
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
                            "Per-endpoint request rate unavailable (no traffic exporter connected)"
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
        String note = prometheusUrl.isEmpty()
                ? "Endpoint readiness and workload associations come from live Kubernetes Services and EndpointSlices. Per-pod/request traffic distribution metrics are unavailable (no Prometheus traffic exporter configured)."
                : "Endpoint readiness comes from live Kubernetes EndpointSlices. Prometheus endpoint (" + prometheusUrl + ") is configured, but live traffic rate series are not yet queried.";

        return new ServiceTrafficResponse(nsFilter, rateAvailable, note, items);
    }

    private boolean selectorsOverlap(Map<String, String> svcSelector, Map<String, String> workloadSelector) {
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