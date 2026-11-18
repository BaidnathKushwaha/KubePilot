
package com.kubepilot.controller;

import com.kubepilot.dto.TopologyResponse;
import com.kubepilot.service.TopologyDiscoveryService;

import io.kubernetes.client.openapi.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster")
public class TopologyController {

    private final TopologyDiscoveryService topologyService;

    public TopologyController(TopologyDiscoveryService topologyService) {
        this.topologyService = topologyService;
    }

    @GetMapping("/topology")
    public TopologyResponse getTopology(
            @RequestParam(required = false) String namespace) {

        try {
            return topologyService.getTopology(namespace);

        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve cluster topology",
                    exception
            );
        }
    }
}
