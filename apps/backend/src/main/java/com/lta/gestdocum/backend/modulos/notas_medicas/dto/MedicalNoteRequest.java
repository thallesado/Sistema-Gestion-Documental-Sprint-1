package com.lta.gestdocum.backend.modulos.notas_medicas.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record MedicalNoteRequest(
        @NotNull UUID clinicalHistoryId,
        UUID episodeId,
        @NotBlank @Size(max = 40) String noteType,
        @NotBlank @Size(max = 20000) String content) {
}
