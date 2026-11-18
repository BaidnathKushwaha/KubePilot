
package com.kubepilot.service;

import com.kubepilot.dto.*;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.AppsV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.apis.NetworkingV1Api;
import io.kubernetes.client.openapi.apis.DiscoveryV1Api;

import io.kubernetes.client.openapi.models.*;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ResourceDiscoveryService {

    private final AppsV1Api appsApi;
    private final CoreV1Api coreApi;
    private final NetworkingV1Api networkingApi;
    private final DiscoveryV1Api discoveryApi;

    public ResourceDiscoveryService(ApiClient apiClient) {
        this.appsApi = new AppsV1Api(apiClient);
        this.coreApi = new CoreV1Api(apiClient);
        this.networkingApi = new NetworkingV1Api(apiClient);
        this.discoveryApi = new DiscoveryV1Api(apiClient);
    }

    // 1.7 DEPLOYMENTS

    public List<DeploymentResponse> getDeployments(String namespace)
            throws ApiException {

        V1DeploymentList list = namespace == null || namespace.isBlank()
                ? appsApi.listDeploymentForAllNamespaces().execute()
                : appsApi.listNamespacedDeployment(namespace).execute();

        return list.getItems().stream()
                .map(this::mapDeployment)
                .toList();
    }

    private DeploymentResponse mapDeployment(V1Deployment deployment) {

        V1ObjectMeta metadata = deployment.getMetadata();
        V1DeploymentSpec spec = deployment.getSpec();
        V1DeploymentStatus status = deployment.getStatus();

        return new DeploymentResponse(
                metadata.getName(),
                metadata.getNamespace(),
                spec != null && spec.getReplicas() != null
                        ? spec.getReplicas() : 0,
                status != null && status.getReadyReplicas() != null
                        ? status.getReadyReplicas() : 0,
                status != null && status.getAvailableReplicas() != null
                        ? status.getAvailableReplicas() : 0,
                status != null && status.getUpdatedReplicas() != null
                        ? status.getUpdatedReplicas() : 0,
                spec != null && spec.getSelector() != null
                        ? safeMap(spec.getSelector().getMatchLabels())
                        : Map.of(),
                metadata.getCreationTimestamp() != null
                        ? metadata.getCreationTimestamp().toString() : null
        );
    }

    // 1.8 SERVICES

    public List<ServiceResponse> getServices(String namespace)
            throws ApiException {

        V1ServiceList list = namespace == null || namespace.isBlank()
                ? coreApi.listServiceForAllNamespaces().execute()
                : coreApi.listNamespacedService(namespace).execute();

        return list.getItems().stream()
                .map(this::mapService)
                .toList();
    }

    private ServiceResponse mapService(V1Service service) {

        V1ObjectMeta metadata = service.getMetadata();
        V1ServiceSpec spec = service.getSpec();

        List<ServicePortResponse> ports = new ArrayList<>();

        if (spec != null && spec.getPorts() != null) {
            for (V1ServicePort port : spec.getPorts()) {
                ports.add(new ServicePortResponse(
                        port.getName(),
                        port.getProtocol(),
                        port.getPort() != null ? port.getPort() : 0,
                        port.getTargetPort() != null
                                ? port.getTargetPort().toString() : null,
                        port.getNodePort()
                ));
            }
        }

        return new ServiceResponse(
                metadata.getName(),
                metadata.getNamespace(),
                spec != null ? spec.getType() : null,
                spec != null ? spec.getClusterIP() : null,
                spec != null ? safeMap(spec.getSelector()) : Map.of(),
                ports,
                metadata.getCreationTimestamp() != null
                        ? metadata.getCreationTimestamp().toString() : null
        );
    }

    // 1.9 INGRESSES

    public List<IngressResponse> getIngresses(String namespace)
            throws ApiException {

        V1IngressList list = namespace == null || namespace.isBlank()
                ? networkingApi.listIngressForAllNamespaces().execute()
                : networkingApi.listNamespacedIngress(namespace).execute();

        return list.getItems().stream()
                .map(this::mapIngress)
                .toList();
    }

    private IngressResponse mapIngress(V1Ingress ingress) {

        V1ObjectMeta metadata = ingress.getMetadata();
        V1IngressSpec spec = ingress.getSpec();

        List<String> hosts = new ArrayList<>();
        List<IngressRouteResponse> routes = new ArrayList<>();

        if (spec != null && spec.getRules() != null) {

            for (V1IngressRule rule : spec.getRules()) {

                String host = rule.getHost();
                if (host != null && !hosts.contains(host)) {
                    hosts.add(host);
                }

                if (rule.getHttp() == null
                        || rule.getHttp().getPaths() == null) {
                    continue;
                }

                for (V1HTTPIngressPath path : rule.getHttp().getPaths()) {

                    V1IngressBackend backend = path.getBackend();
                    V1IngressServiceBackend serviceBackend =
                            backend != null ? backend.getService() : null;

                    if (serviceBackend == null) {
                        continue;
                    }

                    V1ServiceBackendPort port = serviceBackend.getPort();

                    String servicePort = null;

                    if (port != null) {
                        servicePort = port.getNumber() != null
                                ? port.getNumber().toString()
                                : port.getName();
                    }

                    routes.add(new IngressRouteResponse(
                            host,
                            path.getPath(),
                            path.getPathType(),
                            serviceBackend.getName(),
                            servicePort
                    ));
                }
            }
        }

        return new IngressResponse(
                metadata.getName(),
                metadata.getNamespace(),
                spec != null ? spec.getIngressClassName() : null,
                hosts,
                routes,
                metadata.getCreationTimestamp() != null
                        ? metadata.getCreationTimestamp().toString() : null
        );
    }

    // 1.10 ENDPOINT SLICES

    public List<EndpointSliceResponse> getEndpointSlices(String namespace)
            throws ApiException {

        V1EndpointSliceList list =
                namespace == null || namespace.isBlank()
                        ? discoveryApi.listEndpointSliceForAllNamespaces()
                        .execute()
                        : discoveryApi.listNamespacedEndpointSlice(namespace)
                        .execute();

        return list.getItems().stream()
                .map(this::mapEndpointSlice)
                .toList();
    }

    private EndpointSliceResponse mapEndpointSlice(
            V1EndpointSlice slice) {

        V1ObjectMeta metadata = slice.getMetadata();

        List<EndpointResponse> endpoints = new ArrayList<>();

        if (slice.getEndpoints() != null) {

            for (DiscoveryV1Endpoint endpoint : slice.getEndpoints()) {

                DiscoveryV1EndpointConditions conditions =
                        endpoint.getConditions();

                V1ObjectReference target = endpoint.getTargetRef();

                endpoints.add(new EndpointResponse(
                        endpoint.getAddresses() != null
                                ? endpoint.getAddresses() : List.of(),
                        conditions != null ? conditions.getReady() : null,
                        target != null ? target.getKind() : null,
                        target != null ? target.getName() : null
                ));
            }
        }

        List<EndpointPortResponse> ports = new ArrayList<>();

        if (slice.getPorts() != null) {
            for (DiscoveryV1EndpointPort port : slice.getPorts()) {
                ports.add(new EndpointPortResponse(
                        port.getName(),
                        port.getProtocol(),
                        port.getPort()
                ));
            }
        }

        String serviceName = metadata.getLabels() != null
                ? metadata.getLabels().get("kubernetes.io/service-name")
                : null;

        return new EndpointSliceResponse(
                metadata.getName(),
                metadata.getNamespace(),
                serviceName,
                slice.getAddressType(),
                endpoints,
                ports
        );
    }

    private Map<String, String> safeMap(Map<String, String> value) {
        return value != null ? Map.copyOf(value) : Map.of();
    }
}
