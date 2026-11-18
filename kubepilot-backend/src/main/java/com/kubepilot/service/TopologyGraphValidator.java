
package com.kubepilot.service;

import com.kubepilot.dto.TopologyEdge;
import com.kubepilot.dto.TopologyNode;
import com.kubepilot.dto.TopologyResponse;

import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class TopologyGraphValidator {

    public TopologyResponse validate(TopologyResponse topology) {

        List<TopologyNode> nodes = topology.nodes();
        List<TopologyEdge> edges = topology.edges();

        Set<String> nodeIds = new HashSet<>();

        // Validate unique node IDs.
        for (TopologyNode node : nodes) {

            if (node.id() == null || node.id().isBlank()) {
                throw new IllegalStateException(
                        "Topology contains a node with an empty ID"
                );
            }

            if (!nodeIds.add(node.id())) {
                throw new IllegalStateException(
                        "Duplicate topology node: " + node.id()
                );
            }
        }

        Set<String> edgeKeys = new HashSet<>();

        // Validate edge references and uniqueness.
        for (TopologyEdge edge : edges) {

            if (!nodeIds.contains(edge.sourceId())) {
                throw new IllegalStateException(
                        "Dangling edge source: " + edge.sourceId()
                );
            }

            if (!nodeIds.contains(edge.targetId())) {
                throw new IllegalStateException(
                        "Dangling edge target: " + edge.targetId()
                );
            }

            String edgeKey = edge.sourceId()
                    + "|" + edge.targetId()
                    + "|" + edge.relation();

            if (!edgeKeys.add(edgeKey)) {
                throw new IllegalStateException(
                        "Duplicate topology edge: " + edgeKey
                );
            }
        }

        return topology;
    }
}
