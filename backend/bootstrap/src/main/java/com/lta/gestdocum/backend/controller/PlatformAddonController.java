package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AddonDtos.*;
import com.lta.gestdocum.backend.dto.PlatformTenantOverviewResponse;
import com.lta.gestdocum.backend.service.PlatformAddonService;
import com.lta.gestdocum.backend.service.PlatformTenantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Catálogo de complementos y cortesías desde la ficha; solo administración global. */
@RestController
@RequestMapping("/api/v1/platform")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformAddonController {
    private final PlatformAddonService addons;
    private final PlatformTenantService tenants;

    public PlatformAddonController(PlatformAddonService addons, PlatformTenantService tenants) {
        this.addons = addons;
        this.tenants = tenants;
    }

    @GetMapping("/addons")
    public List<CatalogItem> catalog() { return addons.catalog(); }

    @PostMapping("/addons")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogItem create(@Valid @RequestBody AddonCreate request) { return addons.create(request); }

    @PutMapping("/addons/{id}")
    public CatalogItem update(@PathVariable UUID id, @Valid @RequestBody AddonUpdate request) { return addons.update(id, request); }

    @PostMapping("/addons/{id}/prices")
    public CatalogItem price(@PathVariable UUID id, @Valid @RequestBody AddonPrice request) { return addons.createPrice(id, request); }

    @PostMapping("/tenants/{tenantId}/addons")
    public PlatformTenantOverviewResponse grant(@PathVariable UUID tenantId, @Valid @RequestBody CourtesyGrant request) {
        addons.grantCourtesy(tenantId, request);
        return tenants.overview(tenantId);
    }

    @PostMapping("/tenants/{tenantId}/addons/{tenantAddonId}/revoke")
    public PlatformTenantOverviewResponse revoke(@PathVariable UUID tenantId, @PathVariable UUID tenantAddonId,
                                                 @Valid @RequestBody Reason request) {
        addons.revokeCourtesy(tenantId, tenantAddonId, request.reason());
        return tenants.overview(tenantId);
    }
}
