package com.kubepilot.controller;

import com.kubepilot.dto.NodeDetailResponse;
import com.kubepilot.dto.NodeResponse;
import com.kubepilot.service.NodeDiscoveryService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/cluster")
public class NodeController {

    private final NodeDiscoveryService nodeDiscoveryService;

    public NodeController(NodeDiscoveryService nodeDiscoveryService) {
        this.nodeDiscoveryService = nodeDiscoveryService;
    }

    @GetMapping("/nodes")
    public List<NodeResponse> getNodes() {

        try {
            return nodeDiscoveryService.getNodes();

        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve nodes from Kubernetes",
                    exception
            );
        }
    }

    @GetMapping("/nodes/{name}/details")
    public NodeDetailResponse getNodeDetails(@PathVariable String name) {
        try {
            return nodeDiscoveryService.getNodeDetails(name);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    exception.getMessage(),
                    exception
            );
        } catch (ApiException exception) {
            HttpStatus status = exception.getCode() == 404
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_GATEWAY;
            throw new ResponseStatusException(
                    status,
                    "Unable to retrieve node details for " + name,
                    exception
            );
        }
    }
}