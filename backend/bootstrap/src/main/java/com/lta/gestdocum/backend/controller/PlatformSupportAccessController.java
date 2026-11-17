package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AddonDtos.Reason;
import com.lta.gestdocum.backend.dto.SupportAccessDtos.*;
import com.lta.gestdocum.backend.service.SupportAccessService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Acceso de soporte desde la plataforma: solicitar, aprobar internamente una emergencia, anular y abrir la
 * sesión de solo lectura. No existe ningún endpoint para iniciar sesión como un usuario del tenant.
 */
@RestController
@RequestMapping("/api/v1/platform/support-access")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformSupportAccessController {
    private final SupportAccessService support;

    public PlatformSupportAccessController(SupportAccessService support) { this.support = support; }

    @GetMapping
    public List<Request> list(@RequestParam(required = false) UUID tenantId) { return support.platformList(tenantId); }

    @GetMapping("/modules")
    public List<SupportModule> modules() { return support.modules(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('platform:support:access')")
    public Request request(@Valid @RequestBody RequestCreate request) { return support.request(request); }

    @PostMapping("/{id}/approve-internal")
    public Request approveInternal(@PathVariable UUID id, @Valid @RequestBody Reason request) {
        return support.approveInternal(id, request.reason());
    }

    @PostMapping("/{id}/cancel")
    public Request cancel(@PathVariable UUID id, @Valid @RequestBody Reason request) { return support.cancel(id, request.reason()); }

    @PostMapping("/{id}/session")
    @PreAuthorize("hasAuthority('platform:support:access')")
    public Session session(@PathVariable UUID id) { return support.startSession(id); }
}
