package com.lta.gestdocum.backend.modulos.documentos.dto;

import com.lta.gestdocum.backend.modulos.documentos.modelo.Document;
import jakarta.validation.constraints.NotNull;

public record DocumentStatusRequest(@NotNull Document.DocumentStatus status) {
}
