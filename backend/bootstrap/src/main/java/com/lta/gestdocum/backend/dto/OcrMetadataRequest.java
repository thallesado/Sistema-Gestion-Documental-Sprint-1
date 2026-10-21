package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Size;

/** Correcciones del revisor sobre lo extraído. Un campo nulo o vacío significa "sin cambios". */
public record OcrMetadataRequest(
        @Size(max = 30) String documentType,
        @Size(max = 200) String patientName,
        @Size(max = 60) String patientDocumentNumber,
        @Size(max = 200) String doctorName,
        @Size(max = 10) String issueDate) {
}
