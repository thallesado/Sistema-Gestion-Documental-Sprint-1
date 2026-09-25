package com.lta.gestdocum.backend.modulos.autenticacion.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ForgotPasswordRequest(
        UUID tenantId,
        @NotBlank @Email String email
) {}
