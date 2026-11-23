package com.kubepilot.service;

import com.kubepilot.dto.ClusterEventResponse;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.CoreV1Event;
import io.kubernetes.client.openapi.models.CoreV1EventList;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class EventDiscoveryService {

    private final CoreV1Api coreV1Api;

    public EventDiscoveryService(ApiClient apiClient) {
        this.coreV1Api = new CoreV1Api(apiClient);
    }

    public List<ClusterEventResponse> getEvents(
            String namespace,
            String involvedKind,
            String eventType,
            String search
    ) throws ApiException {
        CoreV1EventList eventList = namespace != null && !namespace.isBlank()
                ? coreV1Api.listNamespacedEvent(namespace).execute()
                : coreV1Api.listEventForAllNamespaces().execute();

        String kindFilter = involvedKind != null && !involvedKind.isBlank() ? involvedKind.trim() : null;
        String typeFilter = eventType != null && !eventType.isBlank() ? eventType.trim() : null;
        String searchFilter = search != null && !search.isBlank() ? search.trim().toLowerCase() : null;

        List<ClusterEventResponse> mapped = new ArrayList<>();

        for (CoreV1Event ev : eventList.getItems()) {
            String kind = ev.getInvolvedObject() != null ? ev.getInvolvedObject().getKind() : null;
            String name = ev.getInvolvedObject() != null ? ev.getInvolvedObject().getName() : null;
            String evNs = ev.getInvolvedObject() != null && ev.getInvolvedObject().getNamespace() != null
                    ? ev.getInvolvedObject().getNamespace()
                    : (ev.getMetadata() != null ? ev.getMetadata().getNamespace() : null);

            String type = ev.getType() != null && !ev.getType().isBlank() ? ev.getType() : "Normal";
            String reason = ev.getReason();
            String message = ev.getMessage();
            String source = ev.getSource() != null && ev.getSource().getComponent() != null
                    ? ev.getSource().getComponent()
                    : ev.getReportingComponent();
            int count = ev.getCount() != null ? ev.getCount() : 1;
            String uid = ev.getMetadata() != null ? ev.getMetadata().getUid() : null;

            String ts = ev.getEventTime() != null
                    ? ev.getEventTime().toString()
                    : ev.getLastTimestamp() != null
                    ? ev.getLastTimestamp().toString()
                    : ev.getFirstTimestamp() != null
                    ? ev.getFirstTimestamp().toString()
                    : null;

            if (kindFilter != null && !kindFilter.equalsIgnoreCase(kind)) {
                continue;
            }
            if (typeFilter != null && !typeFilter.equalsIgnoreCase(type)) {
                continue;
            }
            if (searchFilter != null) {
                boolean matches = (reason != null && reason.toLowerCase().contains(searchFilter))
                        || (message != null && message.toLowerCase().contains(searchFilter))
                        || (name != null && name.toLowerCase().contains(searchFilter))
                        || (kind != null && kind.toLowerCase().contains(searchFilter))
                        || (evNs != null && evNs.toLowerCase().contains(searchFilter))
                        || (source != null && source.toLowerCase().contains(searchFilter));
                if (!matches) {
                    continue;
                }
            }

            mapped.add(new ClusterEventResponse(
                    uid,
                    type,
                    reason,
                    message,
                    count,
                    kind,
                    name,
                    evNs,
                    source,
                    ts
            ));
        }

        mapped.sort(Comparator.comparing(
                ClusterEventResponse::timestamp,
                Comparator.nullsLast(Comparator.reverseOrder())
        ));

        return mapped;
    }
}