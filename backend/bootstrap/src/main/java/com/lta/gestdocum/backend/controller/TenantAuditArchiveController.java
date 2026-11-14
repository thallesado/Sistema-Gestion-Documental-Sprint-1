package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AuditEventResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.service.TenantAuditArchiveService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Explicit platform-admin endpoint for central evidence retained after a tenant database is removed. */
@RestController
@ConditionalOnProperty(name = "app.tenant-databases.routing-enabled", havingValue = "true")
@RequestMapping("/api/v1/audit/archived-tenants")
public class TenantAuditArchiveController {
    private final TenantAuditArchiveService archive;
    private final AuthenticatedUserContext context;

    public TenantAuditArchiveController(TenantAuditArchiveService archive, AuthenticatedUserContext context) {
        this.archive = archive;
        this.context = context;
    }

    @GetMapping("/{tenantId}")
    @PreAuthorize("hasAuthority('audit:read_global')")
    public Page<AuditEventResponse> list(@PathVariable UUID tenantId, Pageable pageable) {
        var user = context.require();
        if (user.tenantId() != null || !user.authorities().contains("audit:read_global")) {
            throw new org.springframework.security.access.AccessDeniedException("Se requiere acceso global de auditoría.");
        }
        return archive.list(user.userId(), tenantId, pageable);
    }
}
