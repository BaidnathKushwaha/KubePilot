package com.kubepilot.service;

import io.kubernetes.client.openapi.models.V1Deployment;
import io.kubernetes.client.openapi.models.V1DeploymentSpec;
import io.kubernetes.client.openapi.models.V1DeploymentStatus;

import org.springframework.stereotype.Component;

@Component
public class DeploymentHealthEvaluator {

    public String evaluate(V1Deployment deployment) {

        V1DeploymentSpec spec = deployment.getSpec();
        V1DeploymentStatus status = deployment.getStatus();

        int desired = spec != null && spec.getReplicas() != null
                ? spec.getReplicas()
                : 0;

        int ready = status != null && status.getReadyReplicas() != null
                ? status.getReadyReplicas()
                : 0;

        int available = status != null && status.getAvailableReplicas() != null
                ? status.getAvailableReplicas()
                : 0;

        if (desired == 0) {
            return "SCALED_DOWN";
        }

        if (ready == 0) {
            return "UNHEALTHY";
        }

        if (ready < desired || available < desired) {
            return "DEGRADED";
        }

        return "HEALTHY";
    }
}