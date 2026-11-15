# Robot Shop Infrastructure

KubePilot uses [Stan's Robot Shop](https://github.com/instana/robot-shop) as its sample microservices workload for Kubernetes discovery, monitoring, and operational testing.

## Directory Structure

- `chart/`: Customized Helm chart used to deploy Robot Shop.
- `manifests/`: KubePilot-specific Kubernetes manifests, including Ingress configuration.

## Customizations

The chart has been adapted for the local KubePilot development environment. Changes include resource requests and limits, Redis storage configuration, and service exposure settings.

## Attribution

Original application: [Instana Robot Shop](https://github.com/instana/robot-shop)

The original project is distributed under the license included in its upstream repository. This directory contains KubePilot-specific deployment customizations, not a redistribution of the complete upstream source.