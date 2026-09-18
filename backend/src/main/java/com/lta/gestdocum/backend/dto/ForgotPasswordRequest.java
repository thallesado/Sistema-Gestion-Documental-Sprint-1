package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ForgotPasswordRequest(
        UUID tenantId,
        @NotBlank @Email String email
) {}
