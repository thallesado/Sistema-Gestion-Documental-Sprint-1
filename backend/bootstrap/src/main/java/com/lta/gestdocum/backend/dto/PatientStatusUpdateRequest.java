package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record PatientStatusUpdateRequest(@NotBlank String status) {
}
