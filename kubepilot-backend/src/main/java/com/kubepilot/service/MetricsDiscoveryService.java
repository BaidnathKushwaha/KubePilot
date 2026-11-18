
package com.kubepilot.service;

import com.kubepilot.dto.ContainerMetricsResponse;
import com.kubepilot.dto.NodeMetricsResponse;
import com.kubepilot.dto.PodMetricsResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CustomObjectsApi;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class MetricsDiscoveryService {

    private static final String GROUP = "metrics.k8s.io";
    private static final String VERSION = "v1beta1";

    private final CustomObjectsApi customObjectsApi;

    public MetricsDiscoveryService(ApiClient apiClient) {
        this.customObjectsApi = new CustomObjectsApi(apiClient);
    }

    public List<NodeMetricsResponse> getNodeMetrics()
            throws ApiException {

        Object response = customObjectsApi
                .listClusterCustomObject(
                        GROUP, VERSION, "nodes"
                )
                .execute();

        Map<?, ?> root = asMap(response);
        List<?> items = asList(root.get("items"));

        List<NodeMetricsResponse> result = new ArrayList<>();

        for (Object item : items) {

            Map<?, ?> metric = asMap(item);
            Map<?, ?> metadata = asMap(metric.get("metadata"));
            Map<?, ?> usage = asMap(metric.get("usage"));

            result.add(new NodeMetricsResponse(
                    stringValue(metadata.get("name")),
                    parseCpu(usage.get("cpu")),
                    parseMemory(usage.get("memory")),
                    stringValue(metric.get("timestamp")),
                    stringValue(metric.get("window"))
            ));
        }

        return result;
    }

    public List<PodMetricsResponse> getPodMetrics(String namespace)
            throws ApiException {

        Object response = customObjectsApi
                .listNamespacedCustomObject(
                        GROUP, VERSION, namespace, "pods"
                )
                .execute();

        return mapPodMetrics(response);
    }

    public List<PodMetricsResponse> getAllPodMetrics()
            throws ApiException {

        Object response = customObjectsApi
                .listClusterCustomObject(
                        GROUP, VERSION, "pods"
                )
                .execute();

        return mapPodMetrics(response);
    }

    private List<PodMetricsResponse> mapPodMetrics(Object response) {

        Map<?, ?> root = asMap(response);
        List<?> items = asList(root.get("items"));

        List<PodMetricsResponse> result = new ArrayList<>();

        for (Object item : items) {

            Map<?, ?> metric = asMap(item);
            Map<?, ?> metadata = asMap(metric.get("metadata"));

            List<?> containerItems =
                    asList(metric.get("containers"));

            List<ContainerMetricsResponse> containers =
                    new ArrayList<>();

            long totalCpu = 0;
            long totalMemory = 0;

            for (Object containerItem : containerItems) {

                Map<?, ?> container = asMap(containerItem);
                Map<?, ?> usage = asMap(container.get("usage"));

                long cpu = parseCpu(usage.get("cpu"));
                long memory = parseMemory(usage.get("memory"));

                totalCpu += cpu;
                totalMemory += memory;

                containers.add(new ContainerMetricsResponse(
                        stringValue(container.get("name")),
                        cpu,
                        memory
                ));
            }

            result.add(new PodMetricsResponse(
                    stringValue(metadata.get("name")),
                    stringValue(metadata.get("namespace")),
                    totalCpu,
                    totalMemory,
                    stringValue(metric.get("timestamp")),
                    stringValue(metric.get("window")),
                    containers
            ));
        }

        return result;
    }

    private long parseCpu(Object value) {

        if (value == null) {
            return 0;
        }

        String quantity = value.toString();

        BigDecimal number;

        if (quantity.endsWith("n")) {
            number = new BigDecimal(
                    quantity.substring(0, quantity.length() - 1)
            ).divide(
                    new BigDecimal("1000000"),
                    6,
                    RoundingMode.HALF_UP
            );

        } else if (quantity.endsWith("u")) {
            number = new BigDecimal(
                    quantity.substring(0, quantity.length() - 1)
            ).divide(
                    new BigDecimal("1000"),
                    6,
                    RoundingMode.HALF_UP
            );

        } else if (quantity.endsWith("m")) {
            number = new BigDecimal(
                    quantity.substring(0, quantity.length() - 1)
            );

        } else {
            number = new BigDecimal(quantity)
                    .multiply(new BigDecimal("1000"));
        }

        return number.setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private long parseMemory(Object value) {

        if (value == null) {
            return 0;
        }

        String quantity = value.toString();

        String[] suffixes = {
                "Ki", "Mi", "Gi", "Ti", "Pi", "Ei",
                "K", "M", "G", "T", "P", "E"
        };

        long[] multipliers = {
                1024L,
                1024L * 1024,
                1024L * 1024 * 1024,
                1024L * 1024 * 1024 * 1024,
                1024L * 1024 * 1024 * 1024 * 1024,
                1024L * 1024 * 1024 * 1024 * 1024 * 1024,
                1000L,
                1000L * 1000,
                1000L * 1000 * 1000,
                1000L * 1000 * 1000 * 1000,
                1000L * 1000 * 1000 * 1000 * 1000,
                1000L * 1000 * 1000 * 1000 * 1000 * 1000
        };

        for (int i = 0; i < suffixes.length; i++) {

            if (quantity.endsWith(suffixes[i])) {

                String number = quantity.substring(
                        0,
                        quantity.length() - suffixes[i].length()
                );

                return new BigDecimal(number)
                        .multiply(BigDecimal.valueOf(multipliers[i]))
                        .setScale(0, RoundingMode.HALF_UP)
                        .longValue();
            }
        }

        return new BigDecimal(quantity)
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
    }

    private Map<?, ?> asMap(Object value) {
        return value instanceof Map<?, ?> map
                ? map
                : Map.of();
    }

    private List<?> asList(Object value) {
        return value instanceof List<?> list
                ? list
                : List.of();
    }

    private String stringValue(Object value) {
        return value != null ? value.toString() : null;
    }
}
