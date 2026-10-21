package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeleteClinicalHistoryRequest(
        @NotBlank(message = "El motivo de la baja clínica es obligatorio")
        @Size(min = 10, max = 500, message = "El motivo debe contener entre 10 y 500 caracteres")
        String reason
) {
}
