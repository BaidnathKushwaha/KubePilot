package com.kubepilot.service;

import com.kubepilot.dto.OperationAuditRecord;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class OperationAuditService {

    private static final int MAX_RECORDS = 500;
    private final ConcurrentLinkedDeque<OperationAuditRecord> records = new ConcurrentLinkedDeque<>();

    public OperationAuditRecord record(
            String operation,
            String targetKind,
            String targetName,
            String namespace,
            String status,
            String details,
            String outcomeMessage
    ) {
        OperationAuditRecord entry = new OperationAuditRecord(
                UUID.randomUUID().toString(),
                operation,
                targetKind,
                targetName,
                namespace,
                status,
                details,
                outcomeMessage,
                Instant.now()
        );
        records.addFirst(entry);
        while (records.size() > MAX_RECORDS) {
            records.pollLast();
        }
        return entry;
    }

    public List<OperationAuditRecord> getRecentRecords(String targetKind, String targetName) {
        List<OperationAuditRecord> snapshot = new ArrayList<>(records);
        return Collections.unmodifiableList(
                snapshot.stream()
                        .filter(r -> targetKind == null || targetKind.isBlank() || targetKind.equalsIgnoreCase(r.targetKind()))
                        .filter(r -> targetName == null || targetName.isBlank() || targetName.equalsIgnoreCase(r.targetName()))
                        .toList()
        );
    }
}