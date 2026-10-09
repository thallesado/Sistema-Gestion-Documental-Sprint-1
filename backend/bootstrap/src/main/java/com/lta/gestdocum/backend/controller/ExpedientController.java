package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ExpedientResponse;
import com.lta.gestdocum.backend.dto.ExpedientCreateRequest;
import com.lta.gestdocum.backend.dto.ExpedientStatusUpdateRequest;
import com.lta.gestdocum.backend.model.Expedient;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;

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
            description = "Lista expedientes del tenant autenticado con filtro por código, nombre o descripción y estado opcional")
    public ResponseEntity<Page<ExpedientResponse>> find(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) Expedient.ExpedientStatus status,
            Pageable pageable) {
        return ResponseEntity.ok(service.find(filter, status, pageable));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('expedient:update')")
    @Operation(summary = "Actualizar estado del expediente")
    public ResponseEntity<ExpedientResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody ExpedientStatusUpdateRequest request) {
        return ResponseEntity.ok(service.updateStatus(id, request.status()));
    }

    @PatchMapping("/{id}/close")
    @PreAuthorize("hasAuthority('expedient:update')")
    @Operation(summary = "Cerrar expediente")
    public ResponseEntity<ExpedientResponse> close(@PathVariable UUID id) {
        return ResponseEntity.ok(service.close(id));
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAuthority('expedient:update')")
    @Operation(summary = "Archivar expediente")
    public ResponseEntity<ExpedientResponse> archive(@PathVariable UUID id) {
        return ResponseEntity.ok(service.archive(id));
    }

    @PatchMapping("/{id}/reopen")
    @PreAuthorize("hasAuthority('expedient:update')")
    @Operation(summary = "Reabrir expediente")
    public ResponseEntity<ExpedientResponse> reopen(@PathVariable UUID id) {
        return ResponseEntity.ok(service.reopen(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('expedient:create')")
    @Operation(summary = "Crear expediente")
    public ResponseEntity<ExpedientResponse> create(@Valid @RequestBody ExpedientCreateRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('expedient:read')")
    @Operation(summary = "Consultar expediente")
    public ResponseEntity<ExpedientResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }
}
