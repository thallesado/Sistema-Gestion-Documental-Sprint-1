package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Datos para convertir una digitalización validada en un documento del repositorio. */
public record OcrIndexRequest(
        @NotNull UUID documentTypeId,
        @Size(max = 60) String code,
        @Size(max = 255) String name,
        UUID departmentId,
        UUID expedientId,
        UUID patientId,
        @Size(max = 10000) String description) {
}
