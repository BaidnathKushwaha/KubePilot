
package com.kubepilot.controller;

import com.kubepilot.dto.ClusterOverviewResponse;
import com.kubepilot.service.ClusterOverviewService;

import io.kubernetes.client.openapi.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster")
public class ClusterOverviewController {

    private final ClusterOverviewService clusterOverviewService;

    public ClusterOverviewController(
            ClusterOverviewService clusterOverviewService) {

        this.clusterOverviewService = clusterOverviewService;
    }

    @GetMapping("/overview")
    public ClusterOverviewResponse getOverview() {

        try {
            return clusterOverviewService.getOverview();

        } catch (ApiException exception) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve cluster overview",
                    exception
            );
        }
    }
}
