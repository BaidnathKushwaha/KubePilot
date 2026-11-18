
package com.kubepilot.controller;

import com.kubepilot.dto.PodResponse;
import com.kubepilot.service.PodDiscoveryService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/cluster")
public class PodController {

    private final PodDiscoveryService podDiscoveryService;

    public PodController(PodDiscoveryService podDiscoveryService) {
        this.podDiscoveryService = podDiscoveryService;
    }

    @GetMapping("/pods")
    public List<PodResponse> getPods(
            @org.springframework.web.bind.annotation.RequestParam(
                    required = false
            ) String namespace) {

        try {

            if (namespace != null && !namespace.isBlank()) {
                return podDiscoveryService.getPodsByNamespace(namespace);
            }

            return podDiscoveryService.getPods();

        } catch (ApiException exception) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve pods from Kubernetes",
                    exception
            );
        }
    }

}
