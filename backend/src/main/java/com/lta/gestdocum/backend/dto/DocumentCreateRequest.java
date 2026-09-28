package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;

import java.time.LocalDate;
import java.util.UUID;

public record DocumentCreateRequest(
        @NotNull UUID documentTypeId,
        UUID expedientId,
        @JsonAlias("responsibleUserId") UUID responsibleId,
        UUID departmentId,
        @NotBlank @Size(max = 60) String code,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 10000) String description,
        LocalDate issueDate,
        LocalDate expiryDate,
        Boolean externalSource,
        @Size(max = 50) String source) {
}
