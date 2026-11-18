
package com.kubepilot.controller;

import com.kubepilot.dto.NodeMetricsResponse;
import com.kubepilot.dto.PodMetricsResponse;
import com.kubepilot.service.MetricsDiscoveryService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/metrics")
public class MetricsController {

    private final MetricsDiscoveryService metricsDiscoveryService;

    public MetricsController(
            MetricsDiscoveryService metricsDiscoveryService) {
        this.metricsDiscoveryService = metricsDiscoveryService;
    }

    @GetMapping("/nodes")
    public List<NodeMetricsResponse> getNodeMetrics() {

        try {
            return metricsDiscoveryService.getNodeMetrics();

        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve node metrics",
                    exception
            );
        }
    }

    @GetMapping("/pods")
    public List<PodMetricsResponse> getPodMetrics(
            @RequestParam(required = false) String namespace) {

        try {

            if (namespace != null && !namespace.isBlank()) {
                return metricsDiscoveryService.getPodMetrics(namespace);
            }

            return metricsDiscoveryService.getAllPodMetrics();

        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve pod metrics",
                    exception
            );
        }
    }
}
