package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AuditEventFilter;
import com.lta.gestdocum.backend.dto.AuditEventResponse;
import com.lta.gestdocum.backend.dto.AuditVerificationResult;
import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.service.AuditAnchorService;
import com.lta.gestdocum.backend.service.AuditQueryUseCase;
import com.lta.gestdocum.backend.service.AuditVerificationService;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit")
@Validated
public class AuditController {

    private final AuditQueryUseCase queryService;
    private final AuditVerificationService verificationService;
    private final AuditAnchorService anchorService;
    private final AuthenticatedUserContext userContext;

    public AuditController(
            AuditQueryUseCase queryService,
            AuditVerificationService verificationService,
            AuditAnchorService anchorService,
            AuthenticatedUserContext userContext) {
        this.queryService = queryService;
        this.verificationService = verificationService;
        this.anchorService = anchorService;
        this.userContext = userContext;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('audit:read_global','audit:read_tenant')")
    public Page<AuditEventResponse> list(
            @RequestParam(required = false)
            @Size(max = 80)
            @Pattern(regexp = "^[A-Za-z0-9:,_-]+$", message = "Formato de acción inválido")
            String action,
            @RequestParam(required = false, name = "type")
            @Size(max = 60)
            @Pattern(regexp = "^[A-Za-z0-9:,_-]+$", message = "Formato de tipo inválido")
            String type,
            @RequestParam(required = false)
            @Pattern(regexp = "^(SUCCESS|FAILURE)$", message = "Resultado inválido")
            String result,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            OffsetDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            OffsetDateTime to,
            Pageable pageable) {
        return queryService.list(new AuditEventFilter(action, type, result, from, to), pageable);
    }

    @GetMapping("/verify")
    @PreAuthorize("hasAnyAuthority('audit:read_global','audit:read_tenant')")
    public AuditVerificationResult verify(
            @RequestParam(required = false) UUID tenantId) {
        AuthenticatedUser user = userContext.require();
        UUID targetTenantId;
        if (user.authorities() != null && user.authorities().contains("audit:read_global")) {
            targetTenantId = tenantId != null ? tenantId : user.tenantId();
        } else {
            targetTenantId = user.tenantId();
        }
        return verificationService.verifyTenantChain(targetTenantId);
    }

    @PostMapping("/anchor")
    @PreAuthorize("hasAuthority('audit:read_global')")
    public AuditAnchor createAnchor(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false, defaultValue = "LOCAL_SIGNED") String type) {
        AuthenticatedUser user = userContext.require();
        UUID targetTenantId = tenantId != null ? tenantId : user.tenantId();
        return anchorService.createAnchor(targetTenantId, type, user.userId());
    }
}
