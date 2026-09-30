package com.lta.gestdocum.usuarios.domain.repository;

import java.util.UUID;

/**
 * Port para la revocación de sesiones de usuario (Arquitectura Hexagonal).
 * Implementado por el adaptador de autenticación en modules/autenticacion.
 */
public interface UserSessionRevocationPort {
    void revokeAll(UUID userId);
}
