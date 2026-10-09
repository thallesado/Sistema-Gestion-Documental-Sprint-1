package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExpedientTypeCreateRequest(
        @NotBlank @Size(max = 120) String name) {
}
