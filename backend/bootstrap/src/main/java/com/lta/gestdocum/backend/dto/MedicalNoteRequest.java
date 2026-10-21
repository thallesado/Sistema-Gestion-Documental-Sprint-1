package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record MedicalNoteRequest(
        @NotNull UUID clinicalHistoryId,
        UUID episodeId,
        @NotBlank @Size(max = 40) String noteType,
        @NotBlank @Size(max = 20000) String content,
        DocumentStatus status) {

    public MedicalNoteRequest(UUID clinicalHistoryId, UUID episodeId, String noteType, String content) {
        this(clinicalHistoryId, episodeId, noteType, content, DocumentStatus.DRAFT);
    }
}

