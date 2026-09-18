package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.MedicalNoteRequest;
import com.lta.gestdocum.backend.dto.MedicalNoteResponse;
import com.lta.gestdocum.backend.service.MedicalNoteService;
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

    public MedicalNoteController(MedicalNoteService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('medical_note:read')")
    public ResponseEntity<Page<MedicalNoteResponse>> find(
            @RequestParam UUID clinicalHistoryId, Pageable pageable) {
        return ResponseEntity.ok(service.find(clinicalHistoryId, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('medical_note:create')")
    public ResponseEntity<MedicalNoteResponse> create(@Valid @RequestBody MedicalNoteRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }
}
