package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.dto.OcrProcessResponse.OcrFieldDTO;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Digitalización persistida. Los campos de extracción reflejan el valor efectivo:
 * lo corregido por el revisor prevalece sobre lo sugerido por el modelo.
 */
public record OcrJobResponse(
        UUID id,
        String status,
        String originalFilename,
        String fileType,
        Long fileSizeBytes,
        String documentType,
        String patientName,
        String patientDocumentNumber,
        String doctorName,
        String issueDate,
        String extractedSummary,
        String fullText,
        Double confidence,
        List<OcrFieldDTO> structuredFields,
        Map<String, Object> finalMetadata,
        String modelUsed,
        Integer processingMs,
        String errorMessage,
        UUID documentId,
        OffsetDateTime createdAt,
        OffsetDateTime validatedAt) {
}
