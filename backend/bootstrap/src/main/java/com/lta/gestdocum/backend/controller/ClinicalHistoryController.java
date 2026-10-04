package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ClinicalHistoryRequest;
import com.lta.gestdocum.backend.dto.ClinicalHistoryResponse;
import com.lta.gestdocum.backend.service.ClinicalHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.util.List;
import com.lta.gestdocum.backend.dto.TimelineEventResponse;
import com.lta.gestdocum.backend.dto.DeleteClinicalHistoryRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import org.springframework.web.bind.annotation.DeleteMapping;

@RestController
@RequestMapping("/api/v1/clinical-histories")
@Tag(name = "Historias Clínicas", description = "Captura estructurada de anamnesis, alergias y antecedentes iniciales del paciente")
@SecurityRequirement(name = "BearerAuth")
public class ClinicalHistoryController {

    private final ClinicalHistoryService service;

    public ClinicalHistoryController(ClinicalHistoryService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('patient:read')")
    @Operation(summary = "Listar historias clínicas",
            description = "Lista historias clínicas del tenant autenticado, filtrando por paciente o código")
    public ResponseEntity<Page<ClinicalHistoryResponse>> find(
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) String filter,
            Pageable pageable) {
        return ResponseEntity.ok(service.find(patientId, filter, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('patient:read')")
    @Operation(summary = "Consultar historia clínica")
    public ResponseEntity<ClinicalHistoryResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @GetMapping("/{id}/timeline")
    @PreAuthorize("hasAuthority('patient:read')")
    @Operation(summary = "Consultar expediente en orden cronológico",
            description = "Devuelve apertura y episodios ordenados por fecha descendente")
    public ResponseEntity<List<TimelineEventResponse>> timeline(@PathVariable UUID id) {
        return ResponseEntity.ok(service.timeline(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('patient:create')")
    @Operation(summary = "Crear historia clínica",
            description = "Captura los datos iniciales de anamnesis, alergias y antecedentes y abre la historia clínica del paciente")
    public ResponseEntity<ClinicalHistoryResponse> create(@Valid @RequestBody ClinicalHistoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }
    @RequestMapping(path = "/{id}", method = {RequestMethod.PUT, RequestMethod.PATCH})
    @PreAuthorize("hasAuthority('patient:update')")
    @Operation(summary = "Actualizar historia clínica",
            description = "Actualiza la captura estructurada de anamnesis, alergias y antecedentes")
    public ResponseEntity<ClinicalHistoryResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody ClinicalHistoryRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('clinical_history:delete', 'patient:delete')")
    @Operation(summary = "Dar de baja historia clínica de forma justificada",
            description = "Aplica baja lógica (soft delete) con motivo obligatorio y genera traza inmutable en auditoría")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @Valid @RequestBody DeleteClinicalHistoryRequest request) {
        service.delete(id, request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/documents")
    @PreAuthorize("hasAnyAuthority('clinical_document:link', 'patient:read')")
    @Operation(summary = "Listar documentos asociados a la historia clínica")
    public ResponseEntity<List<DocumentResponse>> getLinkedDocuments(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getLinkedDocuments(id));
    }

    @PostMapping("/{id}/documents/{documentId}")
    @PreAuthorize("hasAnyAuthority('clinical_document:link', 'patient:update')")
    @Operation(summary = "Vincular documento a la historia clínica")
    public ResponseEntity<DocumentResponse> linkDocument(
            @PathVariable UUID id,
            @PathVariable UUID documentId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.linkDocument(id, documentId));
    }

    @DeleteMapping("/{id}/documents/{documentId}")
    @PreAuthorize("hasAnyAuthority('clinical_document:link', 'patient:update')")
    @Operation(summary = "Desvincular documento de la historia clínica")
    public ResponseEntity<Void> unlinkDocument(
            @PathVariable UUID id,
            @PathVariable UUID documentId) {
        service.unlinkDocument(id, documentId);
        return ResponseEntity.noContent().build();
    }
}