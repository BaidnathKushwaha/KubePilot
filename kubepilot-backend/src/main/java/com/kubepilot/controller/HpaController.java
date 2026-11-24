package com.kubepilot.controller;

import com.kubepilot.dto.HpaResponse;
import com.kubepilot.dto.HpaUpsertRequest;
import com.kubepilot.dto.WorkloadOperationResponse;
import com.kubepilot.service.HpaManagementService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/cluster/hpas")
public class HpaController {

    private final HpaManagementService hpaManagementService;

    public HpaController(HpaManagementService hpaManagementService) {
        this.hpaManagementService = hpaManagementService;
    }

    @GetMapping
    public List<HpaResponse> listHpas(@RequestParam(required = false) String namespace) {
        try {
            return hpaManagementService.listHpas(namespace);
        } catch (ApiException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to retrieve HPAs from Kubernetes", e);
        }
    }

    @PostMapping
    public WorkloadOperationResponse createHpa(@RequestBody HpaUpsertRequest request) {
        try {
            return hpaManagementService.createHpa(request);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            throw mapApiException("create HPA", request != null ? request.name() : "unknown", e);
        }
    }

    @PutMapping("/{namespace}/{name}")
    public WorkloadOperationResponse updateHpa(
            @PathVariable String namespace,
            @PathVariable String name,
            @RequestBody HpaUpsertRequest request
    ) {
        try {
            return hpaManagementService.updateHpa(namespace, name, request);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            throw mapApiException("update HPA", name, e);
        }
    }

    @DeleteMapping("/{namespace}/{name}")
    public WorkloadOperationResponse deleteHpa(
            @PathVariable String namespace,
            @PathVariable String name
    ) {
        try {
            return hpaManagementService.deleteHpa(namespace, name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            throw mapApiException("delete HPA", name, e);
        }
    }

    private ResponseStatusException mapApiException(String action, String hpaName, ApiException e) {
        HttpStatus status = switch (e.getCode()) {
            case 404 -> HttpStatus.NOT_FOUND;
            case 409 -> HttpStatus.CONFLICT;
            case 403 -> HttpStatus.FORBIDDEN;
            default -> HttpStatus.BAD_GATEWAY;
        };
        return new ResponseStatusException(status, "Unable to " + action + " \"" + hpaName + "\" through Kubernetes API", e);
    }
}