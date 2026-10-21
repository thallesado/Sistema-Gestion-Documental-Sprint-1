package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.Document;
import jakarta.validation.constraints.NotNull;

public record DocumentStatusRequest(@NotNull Document.DocumentStatus status) {
}
