package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.PlatformAuditService;
import com.lta.gestdocum.backend.service.PlatformBackupService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/platform/backups/full")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformBackupController {
    private final PlatformBackupService service;
    private final PlatformAuditService audit;
    public PlatformBackupController(PlatformBackupService service, PlatformAuditService audit) {
        this.service = service;
        this.audit = audit;
    }
    /**
     * Exige motivo. La auditoría se escribe antes de encolar el respaldo, en la misma transacción:
     * si la solicitud falla se revierte, y no hay respaldo encolado sin su registro.
     */
    @PostMapping @Transactional(rollbackFor = IOException.class)
    public ResponseEntity<Map<String, Object>> request(@RequestParam String reason) throws IOException {
        audit.record("PLATFORM_BACKUP_REQUESTED", null, reason, null, null);
        return ResponseEntity.accepted().body(service.request());
    }
    @GetMapping("/{id}") public Map<String, Object> status(@PathVariable UUID id) { return service.status(id); }
}
