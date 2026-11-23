package com.kubepilot.controller;

import com.kubepilot.dto.ClusterEventResponse;
import com.kubepilot.service.EventDiscoveryService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/cluster")
public class EventController {

    private final EventDiscoveryService eventDiscoveryService;

    public EventController(EventDiscoveryService eventDiscoveryService) {
        this.eventDiscoveryService = eventDiscoveryService;
    }

    @GetMapping("/events")
    public List<ClusterEventResponse> getEvents(
            @RequestParam(required = false) String namespace,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search
    ) {
        try {
            return eventDiscoveryService.getEvents(namespace, kind, type, search);
        } catch (ApiException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Unable to retrieve cluster events from Kubernetes",
                    exception
            );
        }
    }
}