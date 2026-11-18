
package com.kubepilot.service;

import com.kubepilot.dto.*;

import io.kubernetes.client.openapi.ApiException;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class TopologyDiscoveryService {

    private final TopologyGraphValidator graphValidator;
    private final NodeDiscoveryService nodeService;
    private final PodDiscoveryService podService;
    private final ResourceDiscoveryService resourceService;

    public TopologyDiscoveryService(
            NodeDiscoveryService nodeService,
            PodDiscoveryService podService,
            ResourceDiscoveryService resourceService,
            TopologyGraphValidator graphValidator) {

        this.nodeService = nodeService;
        this.podService = podService;
        this.resourceService = resourceService;
        this.graphValidator = graphValidator;
    }

    public TopologyResponse getTopology(String namespace)
            throws ApiException {

        List<StatefulSetResponse> statefulSets =
                resourceService.getStatefulSets(namespace);

        List<NodeResponse> nodes = nodeService.getNodes();

        List<PodResponse> pods = namespace == null || namespace.isBlank()
                ? podService.getPods()
                : podService.getPodsByNamespace(namespace);

        List<DeploymentResponse> deployments =
                resourceService.getDeployments(namespace);

        List<ServiceResponse> services =
                resourceService.getServices(namespace);

        List<IngressResponse> ingresses =
                resourceService.getIngresses(namespace);

        List<EndpointSliceResponse> slices =
                resourceService.getEndpointSlices(namespace);

        List<TopologyNode> topologyNodes = new ArrayList<>();
        List<TopologyEdge> edges = new ArrayList<>();

        // Add nodes

        // Add nodes

        Set<String> discoveredNodeIds = new HashSet<>();

        for (NodeResponse node : nodes) {

            String id = nodeId("Node", null, node.name());

            discoveredNodeIds.add(id);

            topologyNodes.add(new TopologyNode(
                    id,
                    "Node",
                    node.name(),
                    null,
                    node.status()
            ));
        }

        // Add pods and pod -> node relationships

        Set<String> discoveredPodIds = new HashSet<>();

        for (PodResponse pod : pods) {

            String podId = nodeId(
                    "Pod", pod.namespace(), pod.name());
            discoveredPodIds.add(podId);
            topologyNodes.add(new TopologyNode(
                    podId,
                    "Pod",
                    pod.name(),
                    pod.namespace(),
                    pod.status()
            ));

            if (pod.nodeName() != null) {

                String targetNodeId = nodeId(
                        "Node", null, pod.nodeName());

                if (discoveredNodeIds.contains(targetNodeId)) {
                    edges.add(new TopologyEdge(
                            podId,
                            targetNodeId,
                            "SCHEDULED_ON"
                    ));
                }
            }
        }

        // Add deployments and deployment -> pod relationships
        // based on matching selector labels.

        for (DeploymentResponse deployment : deployments) {

            String deploymentId = nodeId(
                    "Deployment",
                    deployment.namespace(),
                    deployment.name()
            );

            topologyNodes.add(new TopologyNode(
                    deploymentId,
                    "Deployment",
                    deployment.name(),
                    deployment.namespace(),
                    deployment.readyReplicas()
                            + "/" + deployment.desiredReplicas()
                            + " ready"
            ));

            for (PodResponse pod : pods) {

                if (!deployment.namespace().equals(pod.namespace())) {
                    continue;
                }

                if (matchesSelector(deployment.selector(), pod)) {
                    edges.add(new TopologyEdge(
                            deploymentId,
                            nodeId("Pod", pod.namespace(), pod.name()),
                            "SELECTS"
                    ));
                }
            }
        }

        // Add StatefulSets and their actual Pod ownership relationships.

        for (StatefulSetResponse statefulSet : statefulSets) {

            String statefulSetId = nodeId(
                    "StatefulSet",
                    statefulSet.namespace(),
                    statefulSet.name()
            );

            topologyNodes.add(new TopologyNode(
                    statefulSetId,
                    "StatefulSet",
                    statefulSet.name(),
                    statefulSet.namespace(),
                    statefulSet.readyReplicas()
                            + "/" + statefulSet.desiredReplicas()
                            + " ready"
            ));

            for (PodResponse pod : pods) {

                if (!statefulSet.namespace().equals(pod.namespace())) {
                    continue;
                }

                boolean isOwnedByStatefulSet =
                        "StatefulSet".equals(pod.ownerKind())
                                && statefulSet.name().equals(pod.ownerName())
                                && Objects.equals(statefulSet.uid(), pod.ownerUid());

                if (isOwnedByStatefulSet) {
                    edges.add(new TopologyEdge(
                            statefulSetId,
                            nodeId("Pod", pod.namespace(), pod.name()),
                            "OWNS"
                    ));
                }
            }
        }

        // Add services and service -> pod relationships.

        Set<String> discoveredServiceIds = new HashSet<>();
        for (ServiceResponse service : services) {

            String serviceId = nodeId(
                    "Service", service.namespace(), service.name());
            discoveredServiceIds.add(serviceId);
            topologyNodes.add(new TopologyNode(
                    serviceId,
                    "Service",
                    service.name(),
                    service.namespace(),
                    service.type()
            ));

            for (PodResponse pod : pods) {

                if (!service.namespace().equals(pod.namespace())) {
                    continue;
                }

                if (matchesSelector(service.selector(), pod)) {
                    edges.add(new TopologyEdge(
                            serviceId,
                            nodeId("Pod", pod.namespace(), pod.name()),
                            "SELECTS"
                    ));
                }
            }
        }

        // Add ingresses and ingress -> service relationships.

        for (IngressResponse ingress : ingresses) {

            String ingressId = nodeId(
                    "Ingress", ingress.namespace(), ingress.name());

            topologyNodes.add(new TopologyNode(
                    ingressId,
                    "Ingress",
                    ingress.name(),
                    ingress.namespace(),
                    ingress.ingressClassName()
            ));

            for (IngressRouteResponse route : ingress.routes()) {

                String serviceId = nodeId(
                        "Service",
                        ingress.namespace(),
                        route.serviceName()
                );

                if (discoveredServiceIds.contains(serviceId)) {
                    edges.add(new TopologyEdge(
                            ingressId,
                            serviceId,
                            "ROUTES_TO"
                    ));
                }
            }
        }

        // Add EndpointSlices and their service/pod relationships.

        for (EndpointSliceResponse slice : slices) {

            String sliceId = nodeId(
                    "EndpointSlice", slice.namespace(), slice.name());

            topologyNodes.add(new TopologyNode(
                    sliceId,
                    "EndpointSlice",
                    slice.name(),
                    slice.namespace(),
                    slice.addressType()
            ));

            if (slice.serviceName() != null) {

                String serviceId = nodeId(
                        "Service",
                        slice.namespace(),
                        slice.serviceName()
                );

                if (discoveredServiceIds.contains(serviceId)) {
                    edges.add(new TopologyEdge(
                            serviceId,
                            sliceId,
                            "HAS_ENDPOINT_SLICE"
                    ));
                }
            }

            for (EndpointResponse endpoint : slice.endpoints()) {

                if (!"Pod".equals(endpoint.targetRefKind())
                        || endpoint.targetRefName() == null) {
                    continue;
                }

                String podId = nodeId(
                        "Pod",
                        slice.namespace(),
                        endpoint.targetRefName()
                );

                if (discoveredPodIds.contains(podId)) {
                    edges.add(new TopologyEdge(
                            sliceId,
                            podId,
                            "HAS_ENDPOINT"
                    ));
                }
            }
        }

        return graphValidator.validate(new TopologyResponse(topologyNodes, edges));
    }

    private boolean matchesSelector(
            Map<String, String> selector,
            PodResponse pod) {

        if (selector == null || selector.isEmpty()
                || pod.labels() == null) {
            return false;
        }

        return selector.entrySet().stream()
                .allMatch(entry ->
                        Objects.equals(
                                pod.labels().get(entry.getKey()),
                                entry.getValue()
                        )
                );
    }

    private String nodeId(String type, String namespace, String name) {
        return namespace == null
                ? type + ":" + name
                : type + ":" + namespace + "/" + name;
    }
}
