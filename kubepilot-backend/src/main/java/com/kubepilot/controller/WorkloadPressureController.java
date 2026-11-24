package com.kubepilot.controller;

import com.kubepilot.dto.WorkloadPressureResponse;
import com.kubepilot.service.WorkloadPressureService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/metrics")
public class WorkloadPressureController {

    private final WorkloadPressureService workloadPressureService;

    public WorkloadPressureController(WorkloadPressureService workloadPressureService) {
        this.workloadPressureService = workloadPressureService;
    }

    @GetMapping("/workloads")
    public WorkloadPressureResponse getWorkloadPressure(
            @RequestParam(required = false) String namespace,
            @RequestParam(required = false) Double cpuThresholdPercent,
            @RequestParam(required = false) Double memoryThresholdPercent,
            @RequestParam(required = false) Double nearLimitPercent
    ) {
        try {
            return workloadPressureService.evaluatePressure(
                    namespace,
                    cpuThresholdPercent,
                    memoryThresholdPercent,
                    nearLimitPercent
            );
        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to evaluate workload resource pressure",
                    exception
            );
        }
    }
}