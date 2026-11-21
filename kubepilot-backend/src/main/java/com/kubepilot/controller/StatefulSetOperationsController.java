package com.kubepilot.controller;

import com.kubepilot.dto.WorkloadOperationResponse;
import com.kubepilot.service.StatefulSetOperationsService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster/statefulsets")
public class StatefulSetOperationsController {

    private final StatefulSetOperationsService statefulSetOperationsService;

    public StatefulSetOperationsController(StatefulSetOperationsService statefulSetOperationsService) {
        this.statefulSetOperationsService = statefulSetOperationsService;
    }

    @PostMapping("/{namespace}/{name}/scale")
    public WorkloadOperationResponse scaleStatefulSet(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestParam int replicas
    ) {
        try {
            return statefulSetOperationsService.scaleStatefulSet(namespace, name, replicas);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            HttpStatus status = e.getCode() == 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY;
            throw new ResponseStatusException(status, "Unable to scale StatefulSet through Kubernetes API", e);
        }
    }

    @PostMapping("/{namespace}/{name}/restart")
    public WorkloadOperationResponse restartStatefulSet(
            @PathVariable String namespace,
            @PathVariable String name
    ) {
        try {
            return statefulSetOperationsService.restartStatefulSet(namespace, name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            HttpStatus status = e.getCode() == 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY;
            throw new ResponseStatusException(status, "Unable to restart StatefulSet through Kubernetes API", e);
        }
    }
}