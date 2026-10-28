package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ReportEmbedResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.service.ReportEmbedService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
@Tag(name = "Reportes", description = "Integración y configuración del módulo embebible ReportIQ")
public class ReportEmbedController {

    private final ReportEmbedService reportEmbedService;
    private final AuthenticatedUserContext userContext;

    public ReportEmbedController(ReportEmbedService reportEmbedService, AuthenticatedUserContext userContext) {
        this.reportEmbedService = reportEmbedService;
        this.userContext = userContext;
    }

    @GetMapping("/embed-config")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Obtener configuración y token embebible firmado para ReportIQ")
    public ResponseEntity<ReportEmbedResponse> getEmbedConfig() {
        AuthenticatedUser user = userContext.require();
        String role = user.authorities().contains("platform:tenant:manage") ? "admin" : "viewer";
        ReportEmbedResponse response = reportEmbedService.getEmbedConfig(
                user.tenantId(),
                user.userId(),
                role
        );
        return ResponseEntity.ok(response);
    }
}
