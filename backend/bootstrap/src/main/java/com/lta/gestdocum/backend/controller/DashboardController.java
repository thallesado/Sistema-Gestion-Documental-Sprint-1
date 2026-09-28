package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.DashboardResponse;
import com.lta.gestdocum.backend.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard", description = "Datos reales del dashboard del tenant autenticado")
@SecurityRequirement(name = "BearerAuth")
public class DashboardController {
    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("""
            hasAuthority('task:read') and hasAuthority('document:read')
            and hasAuthority('expedient:read')
            and hasAnyAuthority('audit:read_tenant','audit:read_global')
            """)
    @Operation(summary = "Cargar dashboard")
    public ResponseEntity<DashboardResponse> load(
            @RequestParam(defaultValue = "10") Integer limit) {
        return ResponseEntity.ok(service.load(limit));
    }
}
