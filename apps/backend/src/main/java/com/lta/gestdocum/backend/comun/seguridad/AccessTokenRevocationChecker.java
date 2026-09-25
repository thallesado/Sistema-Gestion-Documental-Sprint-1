package com.lta.gestdocum.backend.comun.seguridad;

public interface AccessTokenRevocationChecker {
    boolean isRevoked(AuthenticatedUser identity, String token);
}
