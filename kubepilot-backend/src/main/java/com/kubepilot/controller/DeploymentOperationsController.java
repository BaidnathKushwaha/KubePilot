package com.kubepilot.controller;

import com.kubepilot.dto.DeploymentOperationResponse;
import com.kubepilot.dto.RollbackRequest;
import com.kubepilot.dto.RolloutHistoryResponse;
import com.kubepilot.dto.RolloutStatusResponse;
import com.kubepilot.dto.WorkloadOperationResponse;
import com.kubepilot.service.DeploymentOperationsService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster/deployments")
public class DeploymentOperationsController {

    private final DeploymentOperationsService operationsService;

    public DeploymentOperationsController(
            DeploymentOperationsService operationsService
    ) {
        this.operationsService = operationsService;
    }

    @PostMapping("/{namespace}/{name}/scale")
    public DeploymentOperationResponse scaleDeployment(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestParam int replicas
    ) {
        try {
            return operationsService.scaleDeployment(namespace, name, replicas);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (ApiException e) {
            throw kubernetesError("scale Deployment", e);
        }
    }

    @PostMapping("/{namespace}/{name}/restart")
    public DeploymentOperationResponse restartDeployment(
            @PathVariable String namespace,
            @PathVariable String name
    ) {
        try {
            return operationsService.restartDeployment(namespace, name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (ApiException e) {
            throw kubernetesError("restart Deployment", e);
        }
    }

    @GetMapping("/{namespace}/{name}/rollout")
    public RolloutStatusResponse getRolloutStatus(
            @PathVariable String namespace,
            @PathVariable String name
    ) {
        try {
            return operationsService.getRolloutStatus(namespace, name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (ApiException e) {
            throw kubernetesError("inspect rollout status", e);
        }
    }

    @GetMapping("/{namespace}/{name}/rollout/history")
    public RolloutHistoryResponse getRolloutHistory(
            @PathVariable String namespace,
            @PathVariable String name
    ) {
        try {
            return operationsService.getRolloutHistory(namespace, name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (ApiException e) {
            throw kubernetesError("retrieve rollout history", e);
        }
    }

    @PostMapping("/{namespace}/{name}/rollback")
    public WorkloadOperationResponse rollbackDeployment(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody(required = false) RollbackRequest request
    ) {
        try {
            return operationsService.rollbackDeployment(namespace, name, request);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (ApiException e) {
            throw kubernetesError("rollback Deployment", e);
        }
    }

    private ResponseStatusException kubernetesError(
            String operation,
            ApiException exception
    ) {
        HttpStatus status = exception.getCode() == 404
                ? HttpStatus.NOT_FOUND
                : HttpStatus.BAD_GATEWAY;

        return new ResponseStatusException(
                status,
                "Unable to " + operation + " through Kubernetes API",
                exception
        );
    }
}