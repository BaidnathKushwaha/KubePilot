package com.kubepilot.controller;

import com.kubepilot.dto.CreateNamespaceRequest;
import com.kubepilot.dto.NamespaceDetailResponse;
import com.kubepilot.dto.NamespaceOverviewItem;
import com.kubepilot.dto.NamespaceResponse;
import com.kubepilot.dto.WorkloadOperationResponse;
import com.kubepilot.service.NamespaceDiscoveryService;
import com.kubepilot.service.NamespaceManagementService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/cluster")
public class NamespaceController {

    private final NamespaceDiscoveryService namespaceDiscoveryService;
    private final NamespaceManagementService namespaceManagementService;

    public NamespaceController(
            NamespaceDiscoveryService namespaceDiscoveryService,
            NamespaceManagementService namespaceManagementService) {
        this.namespaceDiscoveryService = namespaceDiscoveryService;
        this.namespaceManagementService = namespaceManagementService;
    }

    @GetMapping("/namespaces")
    public List<NamespaceResponse> getNamespaces() {
        try {
            return namespaceDiscoveryService.getNamespaces();
        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve namespaces from Kubernetes",
                    exception
            );
        }
    }

    @GetMapping("/namespaces/overview")
    public List<NamespaceOverviewItem> getNamespaceOverview() {
        try {
            return namespaceManagementService.getNamespaceOverview();
        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve namespace overview from Kubernetes",
                    exception
            );
        }
    }

    @GetMapping("/namespaces/{name}/details")
    public NamespaceDetailResponse getNamespaceDetails(@PathVariable String name) {
        try {
            return namespaceManagementService.getNamespaceDetails(name);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (ApiException exception) {
            HttpStatus status = exception.getCode() == 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY;
            throw new ResponseStatusException(status, "Unable to retrieve namespace details for " + name, exception);
        }
    }

    @DeleteMapping("/{name}")
    public WorkloadOperationResponse deleteNamespace(@PathVariable String name) {
        try {
            return namespaceManagementService.deleteNamespace(name);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (ApiException exception) {
            HttpStatus status = switch (exception.getCode()) {
                case 404 -> HttpStatus.NOT_FOUND;
                case 403 -> HttpStatus.FORBIDDEN;
                case 409 -> HttpStatus.CONFLICT;
                default -> HttpStatus.BAD_GATEWAY;
            };
            throw new ResponseStatusException(
                    status,
                    "Unable to delete namespace \"" + name + "\" through Kubernetes API",
                    exception
            );
        }
    }

    @PostMapping("/namespaces")
    public WorkloadOperationResponse createNamespace(@RequestBody CreateNamespaceRequest request) {
        try {
            return namespaceManagementService.createNamespace(request);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage(), exception);
        } catch (ApiException exception) {
            HttpStatus status = exception.getCode() == 409
                    ? HttpStatus.CONFLICT
                    : exception.getCode() == 403
                    ? HttpStatus.FORBIDDEN
                    : HttpStatus.BAD_GATEWAY;
            String detail = exception.getCode() == 409
                    ? "Namespace already exists: " + (request != null ? request.name() : "")
                    : "Unable to create namespace through Kubernetes API";
            throw new ResponseStatusException(status, detail, exception);
        }
    }
}