package com.lta.gestdocum.backend.security;

public interface AccessTokenRevocationChecker {
    boolean isRevoked(AuthenticatedUser identity, String token);
}
