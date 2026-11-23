package com.kubepilot.controller;

import com.kubepilot.dto.NodeOperationResponse;
import com.kubepilot.service.NodeOperationsService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster/nodes")
public class NodeOperationsController {

    private final NodeOperationsService nodeOperationsService;

    public NodeOperationsController(NodeOperationsService nodeOperationsService) {
        this.nodeOperationsService = nodeOperationsService;
    }

    @PostMapping("/{name}/cordon")
    public NodeOperationResponse cordonNode(@PathVariable String name) {
        try {
            return nodeOperationsService.cordonNode(name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            throw mapApiException("cordon node", name, e);
        }
    }

    @PostMapping("/{name}/uncordon")
    public NodeOperationResponse uncordonNode(@PathVariable String name) {
        try {
            return nodeOperationsService.uncordonNode(name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (ApiException e) {
            throw mapApiException("uncordon node", name, e);
        }
    }

    private ResponseStatusException mapApiException(String action, String nodeName, ApiException e) {
        if (e.getCode() == 404) {
            return new ResponseStatusException(HttpStatus.NOT_FOUND, "Node not found: " + nodeName, e);
        }
        if (e.getCode() == 409) {
            return new ResponseStatusException(HttpStatus.CONFLICT, "Node modified concurrently while trying to " + action + ": " + nodeName, e);
        }
        if (e.getCode() == 403) {
            return new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient permissions to " + action + ": " + nodeName, e);
        }
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to " + action + " through Kubernetes API", e);
    }
}