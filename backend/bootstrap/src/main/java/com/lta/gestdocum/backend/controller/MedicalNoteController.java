package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.MedicalNoteAiDraftResponse;
import com.lta.gestdocum.backend.dto.MedicalNoteRequest;
import com.lta.gestdocum.backend.dto.MedicalNoteResponse;
import com.lta.gestdocum.backend.dto.MedicalNoteStatusRequest;
import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import com.lta.gestdocum.backend.service.MedicalNoteAiService;
import com.lta.gestdocum.backend.service.MedicalNoteService;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/medical-notes")
@Tag(name = "Notas médicas", description = "Notas clínicas inmutables por historia")
@SecurityRequirement(name = "BearerAuth")
public class MedicalNoteController {
    private final MedicalNoteService service;
    private final MedicalNoteAiService aiService;

    public MedicalNoteController(MedicalNoteService service, MedicalNoteAiService aiService) {
        this.service = service;
        this.aiService = aiService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('medical_note:read')")
    public ResponseEntity<Page<MedicalNoteResponse>> find(
            @RequestParam UUID clinicalHistoryId,
            @RequestParam(required = false) DocumentStatus status,
            Pageable pageable) {
        return ResponseEntity.ok(service.find(clinicalHistoryId, status, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('medical_note:create')")
    public ResponseEntity<MedicalNoteResponse> create(@Valid @RequestBody MedicalNoteRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }

    @PostMapping(value = "/ai-draft", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('medical_note:create')")
    @Operation(summary = "Borrador de nota médica a partir de un dictado de voz (IA)",
            description = "Transcribe y estructura el audio en SOAP. No guarda nada: el médico revisa y guarda con POST /medical-notes.")
    public ResponseEntity<MedicalNoteAiDraftResponse> aiDraft(
            @RequestPart("audio") MultipartFile audio,
            @RequestParam UUID clinicalHistoryId,
            @RequestParam(required = false) String language,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        String requested = language != null && !language.isBlank() ? language : acceptLanguage;
        return ResponseEntity.ok(aiService.draft(audio, clinicalHistoryId, requested));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('medical_note:update')")
    @Operation(summary = "Cambiar estado de una nota médica (DRAFT -> APPROVED | VOIDED)")
    public ResponseEntity<MedicalNoteResponse> transition(
            @PathVariable UUID id,
            @Valid @RequestBody MedicalNoteStatusRequest request) {
        return ResponseEntity.ok(service.transition(id, request.status()));
    }
}
