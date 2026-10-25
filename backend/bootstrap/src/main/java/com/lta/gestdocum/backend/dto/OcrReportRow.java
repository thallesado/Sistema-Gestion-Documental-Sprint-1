package com.lta.gestdocum.backend.dto;

import java.util.UUID;

/** Fila del reporte de trabajos OCR. {@code document} es null cuando el componente "nombre" está oculto. */
public record OcrReportRow(
        UUID id,
        String file,
        String document,
        String fileType,
        String uploadedBy,
        Integer pages,
        String confidence,
        String date,
        String status
) {}
