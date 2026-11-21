package com.kubepilot.controller;

import com.kubepilot.dto.WorkloadOperationResponse;
import com.kubepilot.service.PodOperationsService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster/pods")
public class PodOperationsController {

    private final PodOperationsService podOperationsService;

    public PodOperationsController(PodOperationsService podOperationsService) {
        this.podOperationsService = podOperationsService;
    }

    @DeleteMapping("/{namespace}/{name}")
    public WorkloadOperationResponse deletePod(
            @PathVariable String namespace,
            @PathVariable String name
    ) {
        try {
            return podOperationsService.deletePod(namespace, name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            HttpStatus status = e.getCode() == 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY;
            throw new ResponseStatusException(status, "Unable to delete Pod through Kubernetes API", e);
        }
    }
}