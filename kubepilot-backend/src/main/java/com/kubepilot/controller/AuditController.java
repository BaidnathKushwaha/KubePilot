package com.kubepilot.controller;

import com.kubepilot.dto.OperationAuditRecord;
import com.kubepilot.service.OperationAuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final OperationAuditService auditService;

    public AuditController(OperationAuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public List<OperationAuditRecord> getAuditRecords(
            @RequestParam(required = false) String targetKind,
            @RequestParam(required = false) String targetName
    ) {
        return auditService.getRecentRecords(targetKind, targetName);
    }
}