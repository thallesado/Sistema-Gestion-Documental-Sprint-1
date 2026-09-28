package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.TenantDepartmentRequest;
import com.lta.gestdocum.backend.dto.TenantDepartmentResponse;
import com.lta.gestdocum.backend.service.TenantDepartmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/departments")
@Tag(name = "Departamentos", description = "Catálogo de áreas del tenant autenticado")
@SecurityRequirement(name = "BearerAuth")
public class TenantDepartmentController {

    private final TenantDepartmentService service;

    public TenantDepartmentController(TenantDepartmentService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('configuration:read')")
    @Operation(summary = "Listar departamentos")
    public ResponseEntity<Page<TenantDepartmentResponse>> find(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) Boolean active,
            Pageable pageable) {
        return ResponseEntity.ok(service.find(filter, active, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('configuration:read')")
    @Operation(summary = "Consultar departamento")
    public ResponseEntity<TenantDepartmentResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('configuration:create')")
    @Operation(summary = "Crear departamento")
    public ResponseEntity<TenantDepartmentResponse> create(
            @Valid @RequestBody TenantDepartmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @RequestMapping(path = "/{id}", method = {RequestMethod.PUT, RequestMethod.PATCH})
    @PreAuthorize("hasAuthority('configuration:update')")
    @Operation(summary = "Actualizar departamento")
    public ResponseEntity<TenantDepartmentResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody TenantDepartmentRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('configuration:delete')")
    @Operation(summary = "Desactivar departamento")
    public ResponseEntity<Void> deactivate(@PathVariable UUID id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
