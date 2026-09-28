package com.lta.gestdocum.backend.controller;
import com.lta.gestdocum.backend.dto.AuditEventFilter;
import com.lta.gestdocum.backend.dto.AuditEventResponse;
import com.lta.gestdocum.backend.service.AuditQueryUseCase;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/v1/audit")
@Validated
public class AuditController {
    private final AuditQueryUseCase service;

    public AuditController(AuditQueryUseCase service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('audit:read_global','audit:read_tenant')")
    public Page<AuditEventResponse> list(
            @RequestParam(required = false)
            @Size(max = 80)
            @Pattern(regexp = "^[A-Za-z0-9:_-]+$", message = "Formato de acción inválido")
            String action,
            @RequestParam(required = false, name = "type")
            @Size(max = 60)
            @Pattern(regexp = "^[A-Za-z0-9:_-]+$", message = "Formato de tipo inválido")
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
        return service.list(new AuditEventFilter(action, type, result, from, to), pageable);
    }
}
