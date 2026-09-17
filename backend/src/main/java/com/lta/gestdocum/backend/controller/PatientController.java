package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PatientResponse;
import com.lta.gestdocum.backend.service.PatientService;
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
@RequestMapping("/api/v1/patients")
@Tag(name = "Pacientes", description = "Consulta de pacientes del tenant autenticado (el alta corresponde a HU-03)")
@SecurityRequirement(name = "BearerAuth")
public class PatientController {

    private final PatientService service;

    public PatientController(PatientService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('patient:read')")
    @Operation(summary = "Listar pacientes", description = "Lista pacientes del tenant autenticado con filtro por nombre o documento")
    public ResponseEntity<Page<PatientResponse>> find(
            @RequestParam(required = false) String filter,
            Pageable pageable) {
        return ResponseEntity.ok(service.find(filter, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('patient:read')")
    @Operation(summary = "Consultar paciente")
    public ResponseEntity<PatientResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }
}