package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PlatformPlanDtos.*;
import com.lta.gestdocum.backend.exception.ConfirmationRequiredException;
import com.lta.gestdocum.backend.service.PlatformPlanService;
import com.lta.gestdocum.backend.service.PlatformRoleTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Catálogo de planes editable y grupos por defecto de tenants nuevos; solo administración global. */
@RestController
@RequestMapping("/api/v1/platform")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformPlanController {
    private final PlatformPlanService plans;
    private final PlatformRoleTemplateService templates;

    public PlatformPlanController(PlatformPlanService plans, PlatformRoleTemplateService templates) {
        this.plans = plans;
        this.templates = templates;
    }

    @GetMapping("/plans")
    public List<PlanView> list() {
        return plans.list();
    }

    @PutMapping("/plans/{id}")
    public PlanView update(@PathVariable UUID id, @Valid @RequestBody PlanUpdate request) {
        return plans.updatePlan(id, request);
    }

    @PutMapping("/plans/{id}/limits")
    public PlanView limits(@PathVariable UUID id, @Valid @RequestBody LimitsUpdate request) {
        return plans.updateLimits(id, request);
    }

    @PutMapping("/plans/{id}/features")
    public PlanView features(@PathVariable UUID id, @Valid @RequestBody FeaturesUpdate request) {
        return plans.updateFeatures(id, request);
    }

    @PostMapping("/plans/{id}/prices")
    public PlanView createPrice(@PathVariable UUID id, @Valid @RequestBody PriceCreate request) {
        return plans.createPriceVersion(id, request);
    }

    @PostMapping("/plans/prices/{priceId}/migrate")
    public MigrationResult migrate(@PathVariable UUID priceId, @Valid @RequestBody Reason request) {
        return plans.migrateSubscribers(priceId, request.reason());
    }

    @GetMapping("/role-templates")
    public RoleTemplateCatalog roleTemplates() {
        return templates.catalog();
    }

    @PostMapping("/role-templates")
    @ResponseStatus(HttpStatus.CREATED)
    public RoleTemplateCatalog createTemplate(@Valid @RequestBody RoleTemplateSave request) {
        return templates.create(request);
    }

    @PutMapping("/role-templates/{id}")
    public RoleTemplateCatalog updateTemplate(@PathVariable UUID id, @Valid @RequestBody RoleTemplateSave request) {
        return templates.update(id, request);
    }

    @DeleteMapping("/role-templates/{id}")
    public RoleTemplateCatalog deleteTemplate(@PathVariable UUID id, @RequestParam String reason) {
        return templates.delete(id, reason);
    }

    @ExceptionHandler(ConfirmationRequiredException.class)
    public ResponseEntity<Map<String, Object>> confirmationRequired(ConfirmationRequiredException exception) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", 409);
        body.put("error", "Conflict");
        body.put("code", "CONFIRMATION_REQUIRED");
        body.put("message", exception.getMessage());
        body.put("affected", exception.affected());
        body.put("examples", exception.examples());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }
}
