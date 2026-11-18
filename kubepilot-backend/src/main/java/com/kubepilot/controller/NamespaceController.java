
package com.kubepilot.controller;

import com.kubepilot.dto.NamespaceResponse;
import com.kubepilot.service.NamespaceDiscoveryService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/cluster")
public class NamespaceController {

    private final NamespaceDiscoveryService namespaceDiscoveryService;

    public NamespaceController(
            NamespaceDiscoveryService namespaceDiscoveryService) {
        this.namespaceDiscoveryService = namespaceDiscoveryService;
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
}
