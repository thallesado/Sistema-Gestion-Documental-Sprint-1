package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ExpedientTypeResponse;
import com.lta.gestdocum.backend.dto.ExpedientTypeCreateRequest;
import com.lta.gestdocum.backend.service.ExpedientTypeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/expedient-types")
@Tag(name = "Tipos de expediente", description = "Catálogo de tipos del tenant autenticado")
@SecurityRequirement(name = "BearerAuth")
public class ExpedientTypeController {
    private final ExpedientTypeService service;

    public ExpedientTypeController(ExpedientTypeService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('expedient:create')")
    @Operation(summary = "Listar tipos de expediente para creación")
    public ResponseEntity<Page<ExpedientTypeResponse>> find(Pageable pageable) {
        return ResponseEntity.ok(service.find(pageable));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('expedient_type:create')")
    @Operation(summary = "Crear tipo de expediente para el tenant")
    public ResponseEntity<ExpedientTypeResponse> create(@jakarta.validation.Valid @RequestBody ExpedientTypeCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }
}
