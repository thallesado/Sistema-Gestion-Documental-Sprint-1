package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.OcrIndexRequest;
import com.lta.gestdocum.backend.dto.OcrJobResponse;
import com.lta.gestdocum.backend.dto.OcrMetadataRequest;
import com.lta.gestdocum.backend.dto.OcrRejectRequest;
import com.lta.gestdocum.backend.dto.OcrStatsResponse;
import com.lta.gestdocum.backend.service.OcrJobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ocr")
@Tag(name = "OCR Clínico", description = "Motor de digitalización, visión multimodal y extracción documental")
@SecurityRequirement(name = "BearerAuth")
public class OcrController {

    static final String CAN_RUN_OCR =
            "hasAnyAuthority('ocr:create', 'document:create', 'document:update', 'patient:create')";
    static final String CAN_REVIEW_OCR = "hasAnyAuthority('ocr:update', 'document:update')";
    static final String CAN_INDEX_OCR = "hasAuthority('document:create')";
    static final String CAN_READ_OCR =
            "hasAnyAuthority('ocr:read', 'ocr:create', 'document:create', 'document:update', 'patient:create')";

    private final OcrJobService jobService;

    public OcrController(OcrJobService jobService) {
        this.jobService = jobService;
    }

    @PostMapping(value = "/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(CAN_RUN_OCR)
    @Operation(summary = "Procesar documento médico con OCR multimodal (Gemini)",
            description = "Guarda el archivo, extrae texto, clasifica el tipo de documento, identifica paciente y médico, "
                    + "y registra la digitalización. Un fallo de extracción se devuelve con estado FAILED.")
    public ResponseEntity<OcrJobResponse> process(@RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(jobService.process(file));
    }

    @GetMapping("/jobs")
    @PreAuthorize(CAN_READ_OCR)
    @Operation(summary = "Digitalizaciones recientes",
            description = "Las últimas 10 del usuario; con ocr:read, las últimas 10 del tenant")
    public ResponseEntity<List<OcrJobResponse>> recent() {
        return ResponseEntity.ok(jobService.listRecent());
    }

    @GetMapping("/jobs/{id}")
    @PreAuthorize(CAN_READ_OCR)
    @Operation(summary = "Consultar una digitalización")
    public ResponseEntity<OcrJobResponse> job(@PathVariable UUID id) {
        return ResponseEntity.ok(jobService.get(id));
    }

    @GetMapping("/stats")
    @PreAuthorize(CAN_READ_OCR)
    @Operation(summary = "Métricas reales de digitalización del tenant",
            description = "Total, aceptación por revisión humana, confianza media y tiempo medio de procesamiento")
    public ResponseEntity<OcrStatsResponse> stats() {
        return ResponseEntity.ok(jobService.stats());
    }

    @PostMapping("/jobs/{id}/validate")
    @PreAuthorize(CAN_REVIEW_OCR)
    @Operation(summary = "Confirmar la extracción",
            description = "REQUIRES_VALIDATION -> VALIDATED, con correcciones opcionales del revisor")
    public ResponseEntity<OcrJobResponse> validate(@PathVariable UUID id,
                                                   @Valid @RequestBody(required = false) OcrMetadataRequest corrections) {
        return ResponseEntity.ok(jobService.validate(id, corrections));
    }

    @PostMapping("/jobs/{id}/reject")
    @PreAuthorize(CAN_REVIEW_OCR)
    @Operation(summary = "Rechazar la extracción",
            description = "Desde REQUIRES_VALIDATION o VALIDATED; un documento ya indexado no se rechaza")
    public ResponseEntity<OcrJobResponse> reject(@PathVariable UUID id,
                                                 @Valid @RequestBody(required = false) OcrRejectRequest request) {
        return ResponseEntity.ok(jobService.reject(id, request));
    }

    @PostMapping("/jobs/{id}/index")
    @PreAuthorize(CAN_INDEX_OCR)
    @Operation(summary = "Indexar en el repositorio documental",
            description = "VALIDATED -> INDEXED: crea el documento y registra el archivo original como versión 1")
    public ResponseEntity<OcrJobResponse> index(@PathVariable UUID id, @Valid @RequestBody OcrIndexRequest request) {
        return ResponseEntity.ok(jobService.index(id, request));
    }

    @PatchMapping("/jobs/{id}/metadata")
    @PreAuthorize(CAN_REVIEW_OCR)
    @Operation(summary = "Corregir metadatos finales",
            description = "En VALIDATED o INDEXED; si el documento sigue en borrador también se actualiza")
    public ResponseEntity<OcrJobResponse> updateMetadata(@PathVariable UUID id,
                                                         @Valid @RequestBody OcrMetadataRequest corrections) {
        return ResponseEntity.ok(jobService.updateMetadata(id, corrections));
    }
}
