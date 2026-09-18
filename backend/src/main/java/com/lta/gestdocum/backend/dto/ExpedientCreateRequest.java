package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

public record ExpedientCreateRequest(
        @NotNull UUID expedientTypeId,
        UUID responsibleId,
        UUID departmentId,
        @NotBlank @Size(max = 60) String code,
        @NotBlank @Size(max = 200) String name,
        @Size(max = 10000) String description,
        Map<String, Object> metadata) {
}
