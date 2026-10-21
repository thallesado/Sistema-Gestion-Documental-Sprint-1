package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.Expedient.ExpedientStatus;
import jakarta.validation.constraints.NotNull;

public record ExpedientStatusUpdateRequest(
        @NotNull(message = "El estado del expediente es obligatorio")
        ExpedientStatus status) {
}
