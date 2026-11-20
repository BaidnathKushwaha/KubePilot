package com.kubepilot.controller;

import com.kubepilot.dto.PodDetailResponse;
import com.kubepilot.service.PodInspectionService;

import io.kubernetes.client.openapi.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster/pods")
public class PodInspectionController {

    private final PodInspectionService podInspectionService;

    public PodInspectionController(
            PodInspectionService podInspectionService) {

        this.podInspectionService = podInspectionService;
    }

    @GetMapping("/{namespace}/{podName}/details")
    public PodDetailResponse inspectPod(
            @PathVariable String namespace,
            @PathVariable String podName) {

        try {

            return podInspectionService.inspectPod(
                    namespace,
                    podName
            );

        } catch (ApiException exception) {

            HttpStatus httpStatus = exception.getCode() == 404
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_GATEWAY;

            String message = exception.getCode() == 404
                    ? "Pod not found: " + podName
                    : "Unable to inspect Pod: " + podName;

            throw new ResponseStatusException(
                    httpStatus,
                    message,
                    exception
            );
        }
    }
}