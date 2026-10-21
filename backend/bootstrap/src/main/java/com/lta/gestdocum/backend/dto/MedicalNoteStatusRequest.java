package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import jakarta.validation.constraints.NotNull;

public record MedicalNoteStatusRequest(
        @NotNull DocumentStatus status
) {
}
