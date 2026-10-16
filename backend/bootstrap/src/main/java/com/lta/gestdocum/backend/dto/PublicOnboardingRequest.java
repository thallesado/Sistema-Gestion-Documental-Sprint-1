package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PublicOnboardingRequest(
        @NotBlank @Size(max = 160) String tenantName,
        @NotBlank @Pattern(regexp = "(?i)BASIC|PRO") String planCode,
        @NotBlank @Size(max = 160) String administratorName,
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Size(min = 8, max = 128) String password) { }
