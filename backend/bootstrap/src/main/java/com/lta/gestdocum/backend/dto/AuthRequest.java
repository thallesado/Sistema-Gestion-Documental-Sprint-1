package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.UUID;

@Data
public class AuthRequest {
    /** Organización elegida en el selector del login. Tiene prioridad sobre {@code tenantName}. */
    private UUID tenantId;
    /** Alternativa por nombre, código o alias (slug) de la organización. Vacío = administrador de plataforma. */
    private String tenantName;
    @NotBlank private String usernameOrEmail;
    @NotBlank private String password;
}