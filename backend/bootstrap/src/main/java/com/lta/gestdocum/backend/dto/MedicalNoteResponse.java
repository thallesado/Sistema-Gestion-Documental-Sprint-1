package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.Document.DocumentStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MedicalNoteResponse(
        UUID id,
        UUID clinicalHistoryId,
        UUID episodeId,
        UUID authorId,
        String noteType,
        String content,
        DocumentStatus status,
        OffsetDateTime createdAt) {
}
