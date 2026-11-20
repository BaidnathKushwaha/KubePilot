package com.kubepilot.service;

import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import org.springframework.stereotype.Service;

@Service
public class PodLogsService {

    private final CoreV1Api coreV1Api;

    public PodLogsService(CoreV1Api coreV1Api) {
        this.coreV1Api = coreV1Api;
    }

    public String getPodLogs(
            String namespace,
            String podName,
            String container,
            Integer tailLines,
            Boolean timestamps,
            Boolean previous
    ) throws ApiException {

        int effectiveTailLines = tailLines == null ? 200 : tailLines;

        if (effectiveTailLines < 1 || effectiveTailLines > 5000) {
            throw new IllegalArgumentException(
                    "tailLines must be between 1 and 5000"
            );
        }

        var request = coreV1Api.readNamespacedPodLog(
                podName,
                namespace
        );

        request.container(container);
        request.follow(false);
        request.previous(Boolean.TRUE.equals(previous));
        request.tailLines(effectiveTailLines);
        request.timestamps(Boolean.TRUE.equals(timestamps));

        return request.execute();
    }
}