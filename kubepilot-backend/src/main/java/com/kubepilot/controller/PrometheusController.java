package com.kubepilot.controller;

import com.kubepilot.dto.PrometheusMetricsResponse;
import com.kubepilot.dto.PrometheusStatusResponse;
import com.kubepilot.service.PrometheusMonitoringService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/monitoring/prometheus")
public class PrometheusController {

    private final PrometheusMonitoringService prometheusMonitoringService;

    public PrometheusController(
            PrometheusMonitoringService prometheusMonitoringService
    ) {
        this.prometheusMonitoringService = prometheusMonitoringService;
    }

    @GetMapping("/status")
    public PrometheusStatusResponse getStatus() {
        return prometheusMonitoringService.checkConnection();
    }

    @GetMapping("/metrics/pods")
    public PrometheusMetricsResponse getPodMetrics(
            @RequestParam(required = false) String namespace
    ) {
        return prometheusMonitoringService.getPodMetrics(namespace);
    }
}