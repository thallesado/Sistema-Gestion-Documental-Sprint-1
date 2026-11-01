package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AddonDtos.*;
import com.lta.gestdocum.backend.service.TenantAddonService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Complementos de la organización (064): solo el administrador del tenant, como la suscripción. */
@RestController
@RequestMapping("/api/v1/billing/addons")
@PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
public class TenantAddonController {
    private final TenantAddonService addons;

    public TenantAddonController(TenantAddonService addons) { this.addons = addons; }

    @GetMapping
    public Overview overview() { return addons.overview(); }

    @PostMapping("/purchase")
    public PurchaseResult purchase(@Valid @RequestBody Purchase request) { return addons.purchase(request); }

    @PostMapping("/{id}/units")
    public Overview changeUnits(@PathVariable UUID id, @Valid @RequestBody UnitsChange request) {
        return addons.changeUnits(id, request);
    }

    @PostMapping("/checkout/{sessionId}/confirm")
    public Overview confirmCheckout(@PathVariable String sessionId) { return addons.confirmCheckout(sessionId); }
}
