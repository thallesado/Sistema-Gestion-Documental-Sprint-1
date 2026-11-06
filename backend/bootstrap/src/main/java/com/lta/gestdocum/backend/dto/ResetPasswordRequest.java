package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ResetPasswordRequest(
        @NotBlank String token,
        @NotBlank @Size(min = 10, max = 128) String newPassword,
        UUID tenantId
) {}
