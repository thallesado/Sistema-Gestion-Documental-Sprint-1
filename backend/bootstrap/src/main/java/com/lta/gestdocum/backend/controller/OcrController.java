package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.OcrProcessResponse;
import com.lta.gestdocum.backend.service.OcrService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/ocr")
@Tag(name = "OCR Clínico", description = "Motor de digitalización, visión multimodal y extracción documental")
@SecurityRequirement(name = "BearerAuth")
public class OcrController {

    private final OcrService ocrService;

    public OcrController(OcrService ocrService) {
        this.ocrService = ocrService;
    }

    @PostMapping(value = "/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('ocr:create', 'document:create', 'document:update', 'patient:create')")
    @Operation(summary = "Procesar documento médico con OCR multimodal (Gemini)",
            description = "Extrae texto, clasifica el tipo de documento, identifica paciente, médico y extrae pares clave-valor estructurados")
    public ResponseEntity<OcrProcessResponse> process(
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(ocrService.processDocument(file));
    }
}
