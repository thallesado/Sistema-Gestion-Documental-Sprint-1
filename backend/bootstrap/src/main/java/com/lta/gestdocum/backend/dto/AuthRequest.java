package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.UUID;

@Data
public class AuthRequest {
    private UUID tenantId;
    @NotBlank private String usernameOrEmail;
    @NotBlank private String password;
}