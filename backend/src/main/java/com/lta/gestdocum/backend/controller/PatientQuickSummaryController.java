package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PatientQuickSummaryResponse;
import com.lta.gestdocum.backend.service.PatientQuickSummaryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patients")
public class PatientQuickSummaryController {
    private final PatientQuickSummaryService service;

    public PatientQuickSummaryController(PatientQuickSummaryService service) {
        this.service = service;
    }

    @GetMapping("/{id}/quick-summary")
    @PreAuthorize("hasAuthority('patient:read') and hasAuthority('medical_note:read')")
    public PatientQuickSummaryResponse get(@PathVariable UUID id) {
        return service.get(id);
    }
}
