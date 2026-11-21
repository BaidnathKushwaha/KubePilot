package com.kubepilot.controller;

import com.kubepilot.dto.DeploymentOperationResponse;
import com.kubepilot.service.DeploymentOperationsService;

import io.kubernetes.client.openapi.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
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

    // SCALE

    @PostMapping("/{namespace}/{name}/scale")
    public DeploymentOperationResponse scaleDeployment(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestParam int replicas
    ) {

        try {

            return operationsService.scaleDeployment(
                    namespace,
                    name,
                    replicas
            );

        } catch (IllegalArgumentException e) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage()
            );

        } catch (ApiException e) {

            throw kubernetesError(
                    "scale Deployment",
                    e
            );
        }
    }

    // RESTART

    @PostMapping("/{namespace}/{name}/restart")
    public DeploymentOperationResponse restartDeployment(
            @PathVariable String namespace,
            @PathVariable String name
    ) {

        try {

            return operationsService.restartDeployment(
                    namespace,
                    name
            );

        } catch (IllegalArgumentException e) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage()
            );

        } catch (ApiException e) {

            throw kubernetesError(
                    "restart Deployment",
                    e
            );
        }
    }

    // ERROR HANDLING

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