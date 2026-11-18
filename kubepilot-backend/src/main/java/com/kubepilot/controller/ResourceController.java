
package com.kubepilot.controller;

import com.kubepilot.dto.*;
import com.kubepilot.service.ResourceDiscoveryService;

import io.kubernetes.client.openapi.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/cluster")
public class ResourceController {

    private final ResourceDiscoveryService resourceService;

    public ResourceController(ResourceDiscoveryService resourceService) {
        this.resourceService = resourceService;
    }

    @GetMapping("/deployments")
    public List<DeploymentResponse> getDeployments(
            @RequestParam(required = false) String namespace) {
        try {
            return resourceService.getDeployments(namespace);
        } catch (ApiException e) {
            throw kubernetesError("deployments", e);
        }
    }

    @GetMapping("/services")
    public List<ServiceResponse> getServices(
            @RequestParam(required = false) String namespace) {
        try {
            return resourceService.getServices(namespace);
        } catch (ApiException e) {
            throw kubernetesError("services", e);
        }
    }

    @GetMapping("/ingresses")
    public List<IngressResponse> getIngresses(
            @RequestParam(required = false) String namespace) {
        try {
            return resourceService.getIngresses(namespace);
        } catch (ApiException e) {
            throw kubernetesError("ingresses", e);
        }
    }

    @GetMapping("/endpointslices")
    public List<EndpointSliceResponse> getEndpointSlices(
            @RequestParam(required = false) String namespace) {
        try {
            return resourceService.getEndpointSlices(namespace);
        } catch (ApiException e) {
            throw kubernetesError("EndpointSlices", e);
        }
    }

    @GetMapping("/statefulsets")
    public List<StatefulSetResponse> getStatefulSets(
            @RequestParam(required = false) String namespace) {

        try {
            return resourceService.getStatefulSets(namespace);
        } catch (ApiException e) {
            throw kubernetesError("statefulsets", e);
        }
    }

    private ResponseStatusException kubernetesError(
            String resource, ApiException exception) {

        return new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Unable to retrieve " + resource + " from Kubernetes",
                exception
        );
    }
}
