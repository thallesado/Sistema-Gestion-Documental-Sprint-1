package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ExpedientResponse;
import com.lta.gestdocum.backend.service.ExpedientService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/expedients")
@Tag(name = "Expedientes", description = "Consulta de expedientes del tenant autenticado")
@SecurityRequirement(name = "BearerAuth")
public class ExpedientController {

    private final ExpedientService service;

    public ExpedientController(ExpedientService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('expedient:read')")
    @Operation(summary = "Listar expedientes",
            description = "Lista expedientes activos del tenant autenticado con filtro por código, nombre o descripción")
    public ResponseEntity<Page<ExpedientResponse>> find(
            @RequestParam(required = false) String filter,
            Pageable pageable) {
        return ResponseEntity.ok(service.find(filter, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('expedient:read')")
    @Operation(summary = "Consultar expediente")
    public ResponseEntity<ExpedientResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }
}
