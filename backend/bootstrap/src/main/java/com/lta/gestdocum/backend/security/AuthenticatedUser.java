package com.lta.gestdocum.backend.security;

import java.util.Set;
import java.util.UUID;

/**
 * Identidad mínima confiable derivada del JWT validado.
 */
public record AuthenticatedUser(
        UUID userId,
        UUID tenantId,
        String username,
        Set<String> authorities
) {
    public AuthenticatedUser {
        if (userId == null || username == null || username.isBlank()) {
            throw new IllegalArgumentException("La identidad autenticada es inválida");
        }
        authorities = authorities == null ? Set.of() : Set.copyOf(authorities);
        if (authorities.isEmpty() || authorities.stream().anyMatch(String::isBlank)) {
            throw new IllegalArgumentException("La identidad autenticada no tiene permisos");
        }
    }
}
