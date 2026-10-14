package com.lta.gestdocum.backend.dto;

import java.util.List;
import java.util.Map;

public record OcrProcessResponse(
        String documentType,
        String patientName,
        String patientDocumentNumber,
        String doctorName,
        String issueDate,
        String extractedSummary,
        String fullText,
        Double confidence,
        List<OcrFieldDTO> structuredFields,
        Map<String, Object> rawMetadata) {

    public record OcrFieldDTO(String key, String value, String status) {}
}
