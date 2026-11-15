package com.kubepilot.controller;

import com.kubepilot.dto.NodeResponse;
import com.kubepilot.service.NodeDiscoveryService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
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
}