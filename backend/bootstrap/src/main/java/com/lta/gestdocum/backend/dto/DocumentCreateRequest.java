package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record DocumentCreateRequest(
        @NotNull UUID documentTypeId,
        UUID expedientId,
        @JsonAlias("responsibleUserId") UUID responsibleId,
        UUID departmentId,
        UUID patientId,
        String specialty,
        String institutionalProcess,
        java.util.Map<String, Object> metadata,
        @NotBlank @Size(max = 60) String code,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 10000) String description,
        LocalDate issueDate,
        @JsonAlias("expirationDate") LocalDate expiryDate,
        Boolean externalSource,
        @Size(max = 50) String source) {
}
