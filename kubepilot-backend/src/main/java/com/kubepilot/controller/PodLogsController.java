package com.kubepilot.controller;

import com.kubepilot.service.PodLogsService;
import io.kubernetes.client.openapi.ApiException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cluster/pods")
public class PodLogsController {

    private final PodLogsService podLogsService;

    public PodLogsController(PodLogsService podLogsService) {
        this.podLogsService = podLogsService;
    }

    @GetMapping(
            value = "/{namespace}/{podName}/logs",
            produces = MediaType.TEXT_PLAIN_VALUE
    )
    public ResponseEntity<String> getPodLogs(
            @PathVariable String namespace,
            @PathVariable String podName,
            @RequestParam(required = false) String container,
            @RequestParam(defaultValue = "200") Integer tailLines,
            @RequestParam(defaultValue = "true") Boolean timestamps,
            @RequestParam(defaultValue = "false") Boolean previous
    ) throws ApiException {

        String logs = podLogsService.getPodLogs(
                namespace,
                podName,
                container,
                tailLines,
                timestamps,
                previous
        );

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(logs);
    }
}
