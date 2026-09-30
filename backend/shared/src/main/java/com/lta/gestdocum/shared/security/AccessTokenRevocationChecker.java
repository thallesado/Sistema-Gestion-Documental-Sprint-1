package com.lta.gestdocum.shared.security;

public interface AccessTokenRevocationChecker {
    boolean isRevoked(AuthenticatedUser identity, String token);
}
