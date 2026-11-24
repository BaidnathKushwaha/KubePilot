package com.kubepilot.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kubepilot.dto.PodPrometheusMetricResponse;
import com.kubepilot.dto.PrometheusMetricsResponse;
import com.kubepilot.dto.PrometheusStatusResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;

@Service
public class PrometheusMonitoringService {

    private static final String CONNECTIVITY_QUERY = "up";

    private static final String CPU_QUERY =
            "sum by (namespace, pod) (" +
                    "rate(container_cpu_usage_seconds_total{" +
                    "container!=\"\",container!=\"POD\",pod!=\"\"}[5m]))";

    private static final String MEMORY_QUERY =
            "sum by (namespace, pod) (" +
                    "container_memory_working_set_bytes{" +
                    "container!=\"\",container!=\"POD\",pod!=\"\"})";

    private final String prometheusUrl;
    private final RestClient restClient;

    public PrometheusMonitoringService(
            @Value("${kubepilot.monitoring.prometheus-url:}")
            String prometheusUrl
    ) {
        this.prometheusUrl = prometheusUrl == null
                ? ""
                : prometheusUrl.trim().replaceAll("/+$", "");

        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();

        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClient);

        requestFactory.setReadTimeout(Duration.ofSeconds(5));

        this.restClient = RestClient.builder()
                .baseUrl(this.prometheusUrl.isBlank()
                        ? "http://localhost"
                        : this.prometheusUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public PrometheusStatusResponse checkConnection() {

        Instant checkedAt = Instant.now();

        if (prometheusUrl.isBlank()) {
            return new PrometheusStatusResponse(
                    false,
                    false,
                    null,
                    CONNECTIVITY_QUERY,
                    0,
                    checkedAt,
                    "Prometheus URL is not configured"
            );
        }

        try {
            JsonNode response = executeQuery(CONNECTIVITY_QUERY);

            if (response == null
                    || !"success".equals(response.path("status").asText())) {

                return new PrometheusStatusResponse(
                        false,
                        true,
                        prometheusUrl,
                        CONNECTIVITY_QUERY,
                        0,
                        checkedAt,
                        "Prometheus returned an invalid or unsuccessful response"
                );
            }

            JsonNode results = response.path("data").path("result");

            if (!results.isArray()) {
                return new PrometheusStatusResponse(
                        false,
                        true,
                        prometheusUrl,
                        CONNECTIVITY_QUERY,
                        0,
                        checkedAt,
                        "Prometheus response did not contain a valid result array"
                );
            }

            return new PrometheusStatusResponse(
                    true,
                    true,
                    prometheusUrl,
                    CONNECTIVITY_QUERY,
                    results.size(),
                    checkedAt,
                    "Successfully connected to Prometheus"
            );

        } catch (RestClientException exception) {

            return new PrometheusStatusResponse(
                    false,
                    true,
                    prometheusUrl,
                    CONNECTIVITY_QUERY,
                    0,
                    checkedAt,
                    "Unable to communicate with Prometheus"
            );
        }
    }

    public PrometheusMetricsResponse getPodMetrics(String namespace) {

        Instant queriedAt = Instant.now();

        if (prometheusUrl.isBlank()) {
            return new PrometheusMetricsResponse(
                    false,
                    "Prometheus URL is not configured",
                    namespace,
                    queriedAt,
                    java.util.List.of()
            );
        }

        try {
            Map<String, PodMetricData> podMetrics = new TreeMap<>();

            JsonNode cpuResponse = executeQuery(CPU_QUERY);
            validateResponse(cpuResponse);

            JsonNode memoryResponse = executeQuery(MEMORY_QUERY);
            validateResponse(memoryResponse);

            parseMetricResults(
                    cpuResponse.path("data").path("result"),
                    podMetrics,
                    true
            );

            parseMetricResults(
                    memoryResponse.path("data").path("result"),
                    podMetrics,
                    false
            );

            var responseMetrics = podMetrics.entrySet()
                    .stream()
                    .filter(entry -> namespace == null
                            || namespace.isBlank()
                            || namespace.equals(entry.getValue().namespace))
                    .map(entry -> new PodPrometheusMetricResponse(
                            entry.getValue().namespace,
                            entry.getValue().pod,
                            entry.getValue().cpuUsageCores,
                            entry.getValue().memoryUsageBytes,
                            entry.getValue().timestamp
                    ))
                    .toList();

            return new PrometheusMetricsResponse(
                    true,
                    responseMetrics.isEmpty()
                            ? "No pod metrics currently available"
                            : "Pod metrics retrieved successfully",
                    namespace,
                    queriedAt,
                    responseMetrics
            );

        } catch (RestClientException | IllegalStateException exception) {

            return new PrometheusMetricsResponse(
                    false,
                    "Unable to retrieve metrics from Prometheus",
                    namespace,
                    queriedAt,
                    java.util.List.of()
            );
        }
    }

    private JsonNode executeQuery(String query) {

        java.net.URI uri = java.net.URI.create(
                prometheusUrl + "/api/v1/query?query="
                        + java.net.URLEncoder.encode(
                        query,
                        java.nio.charset.StandardCharsets.UTF_8
                )
        );

        return restClient.get()
                .uri(uri)
                .retrieve()
                .body(JsonNode.class);
    }

    private void validateResponse(JsonNode response) {

        if (response == null
                || !"success".equals(response.path("status").asText())
                || !response.path("data").path("result").isArray()) {

            throw new IllegalStateException(
                    "Invalid Prometheus query response"
            );
        }
    }

    private void parseMetricResults(
            JsonNode results,
            Map<String, PodMetricData> podMetrics,
            boolean isCpu
    ) {

        if (!results.isArray()) {
            return;
        }

        for (JsonNode result : results) {

            JsonNode metric = result.path("metric");

            String namespace = metric.path("namespace").asText("");
            String pod = metric.path("pod").asText("");

            if (namespace.isBlank() || pod.isBlank()) {
                continue;
            }

            JsonNode valueArray = result.path("value");

            if (!valueArray.isArray() || valueArray.size() < 2) {
                continue;
            }

            double value;

            try {
                value = Double.parseDouble(valueArray.get(1).asText());
            } catch (NumberFormatException exception) {
                continue;
            }

            Instant sampleTimestamp = parseTimestamp(
                    valueArray.get(0).asText()
            );

            String key = namespace + "/" + pod;

            PodMetricData data = podMetrics.computeIfAbsent(
                    key,
                    ignored -> new PodMetricData(namespace, pod)
            );

            if (isCpu) {
                data.cpuUsageCores = value;
            } else {
                data.memoryUsageBytes = value;
            }

            if (sampleTimestamp != null
                    && (data.timestamp == null
                    || sampleTimestamp.isAfter(data.timestamp))) {
                data.timestamp = sampleTimestamp;
            }
        }
    }

    private Instant parseTimestamp(String timestamp) {

        try {
            double seconds = Double.parseDouble(timestamp);

            long wholeSeconds = (long) seconds;
            long nanos = Math.round(
                    (seconds - wholeSeconds) * 1_000_000_000L
            );

            if (nanos >= 1_000_000_000L) {
                wholeSeconds++;
                nanos -= 1_000_000_000L;
            }

            return Instant.ofEpochSecond(wholeSeconds, nanos);

        } catch (Exception exception) {
            return null;
        }
    }

    private static class PodMetricData {

        private final String namespace;
        private final String pod;

        private Double cpuUsageCores;
        private Double memoryUsageBytes;
        private Instant timestamp;

        private PodMetricData(String namespace, String pod) {
            this.namespace = namespace;
            this.pod = pod;
        }
    }
}