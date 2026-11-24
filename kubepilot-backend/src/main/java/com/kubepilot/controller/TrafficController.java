package com.kubepilot.controller;

import com.kubepilot.dto.ServiceTrafficResponse;
import com.kubepilot.service.TrafficDistributionService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/cluster")
public class TrafficController {

    private final TrafficDistributionService trafficDistributionService;

    public TrafficController(TrafficDistributionService trafficDistributionService) {
        this.trafficDistributionService = trafficDistributionService;
    }

    @GetMapping("/traffic")
    public ServiceTrafficResponse getServiceTraffic(
            @RequestParam(required = false) String namespace
    ) {
        try {
            return trafficDistributionService.getServiceDistribution(namespace);
        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve service traffic and endpoint distribution",
                    exception
            );
        }
    }
}