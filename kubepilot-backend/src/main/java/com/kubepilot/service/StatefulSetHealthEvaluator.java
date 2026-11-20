package com.kubepilot.service;

import io.kubernetes.client.openapi.models.V1StatefulSet;
import io.kubernetes.client.openapi.models.V1StatefulSetSpec;
import io.kubernetes.client.openapi.models.V1StatefulSetStatus;

import org.springframework.stereotype.Component;

@Component
public class StatefulSetHealthEvaluator {

    public String evaluate(V1StatefulSet statefulSet) {

        V1StatefulSetSpec spec = statefulSet.getSpec();

        V1StatefulSetStatus status = statefulSet.getStatus();

        int desired = spec != null && spec.getReplicas() != null
                ? spec.getReplicas()
                : 0;

        int ready = status != null && status.getReadyReplicas() != null
                ? status.getReadyReplicas()
                : 0;

        if (desired == 0) {
            return "SCALED_DOWN";
        }

        if (ready == 0) {
            return "UNHEALTHY";
        }

        if (ready < desired) {
            return "DEGRADED";
        }

        return "HEALTHY";
    }
}