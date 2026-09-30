package com.lta.gestdocum.documentos.application.dto;

import com.lta.gestdocum.documentos.domain.model.Document;
import jakarta.validation.constraints.NotNull;

public record DocumentStatusRequest(@NotNull Document.DocumentStatus status) {
}
