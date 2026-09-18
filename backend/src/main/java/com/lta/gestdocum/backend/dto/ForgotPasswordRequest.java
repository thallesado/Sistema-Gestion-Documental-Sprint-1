package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ForgotPasswordRequest(
        @NotNull UUID tenantId,
        @NotBlank @Email String email
) {}
