package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.service.PlanLimitService;
import com.lta.gestdocum.backend.service.TenantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    private final TenantService service;
    private final PlanLimitService planLimitService;
    private final AuthenticatedUserContext userContext;

    public TenantController(
            TenantService service,
            PlanLimitService planLimitService,
            AuthenticatedUserContext userContext) {
        this.service = service;
        this.planLimitService = planLimitService;
        this.userContext = userContext;
    }

    /** Público (sin autenticación): alimenta el selector de organización del login. */
    @GetMapping("/public")
    public List<TenantPublicResponse> listPublic() {
        return service.listPublic();
    }

    /** Listado global de organizaciones para el superadministrador. */
    @GetMapping
    @PreAuthorize("hasAuthority('platform:tenant:manage')")
    public List<TenantResponse> list() {
        return service.list();
    }

    /** Alta de nueva organización con administrador inicial y plan seleccionado. */
    @PostMapping
    @PreAuthorize("hasAuthority('platform:tenant:manage')")
    @ResponseStatus(HttpStatus.CREATED)
    public TenantResponse create(@Valid @RequestBody TenantCreateRequest request) {
        return service.create(request);
    }

    /** Cambio de estado de la organización (ACTIVE, SUSPENDED, etc.). */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('platform:tenant:manage')")
    public TenantResponse status(@PathVariable UUID id, @RequestParam String value) {
        return service.changeStatus(id, value);
    }

    /** Consulta de ajustes y personalización (E2) de la organización actual. */
    @GetMapping("/current/settings")
    @PreAuthorize("isAuthenticated()")
    public TenantSettingsResponse getCurrentSettings() {
        UUID tenantId = userContext.requireTenantId();
        return service.getSettings(tenantId);
    }

    /** Actualización de marca y regionalización (E2) por el administrador del tenant. */
    @PatchMapping("/current/settings")
    @PreAuthorize("hasAnyAuthority('tenant:update', 'configuration:update', 'tenant:manage')")
    public TenantSettingsResponse updateCurrentSettings(@Valid @RequestBody TenantSettingsUpdateRequest request) {
        UUID tenantId = userContext.requireTenantId();
        return service.updateSettings(tenantId, request);
    }

    /** Consulta del consumo actual y límites del plan (A2) de la organización actual. */
    @GetMapping("/current/usage")
    @PreAuthorize("isAuthenticated()")
    public TenantUsageResponse getCurrentUsage() {
        UUID tenantId = userContext.requireTenantId();
        return planLimitService.getUsage(tenantId);
    }
}
