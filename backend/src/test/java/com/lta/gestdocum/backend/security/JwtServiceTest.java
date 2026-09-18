package com.lta.gestdocum.backend.security;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private final JwtService jwtService = new JwtService(
            "01234567890123456789012345678901", 3_600_000);

    @Test
    void emitsAndReadsTypedClaimsAndAuthorities() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();

        String token = jwtService.generateToken(
                userId, tenantId, "laura.martinez", List.of("user:read", "user:create"));

        AuthenticatedUser identity = jwtService.extractAuthenticatedUser(token);

        assertEquals(userId, identity.userId());
        assertEquals(tenantId, identity.tenantId());
        assertEquals("laura.martinez", identity.username());
        assertEquals(Set.of("user:read", "user:create"), identity.authorities());
        assertTrue(jwtService.isTokenValid(token));
    }

    @Test
    void legacyTokenCompatibilityStillProducesNonEmptyAuthorities() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        String token = jwtService.generateToken(userId, tenantId, "legacy", "USER");

        assertTrue(jwtService.isTokenValid(token));
        assertTrue(jwtService.extractAuthenticatedUser(token).authorities().contains("ROLE_USER"));
    }

    @Test
    void rejectsRefreshTokenAsBearerAuthentication() {
        String refreshToken = jwtService.generateRefreshToken(
                UUID.randomUUID(), UUID.randomUUID(), "user");

        assertFalse(jwtService.isTokenValid(refreshToken));
        assertThrows(io.jsonwebtoken.MalformedJwtException.class,
                () -> jwtService.extractAuthenticatedUser(refreshToken));
    }

    @Test
    void emitsUniqueRefreshTokensForConcurrentSessions() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();

        String first = jwtService.generateRefreshToken(userId, tenantId, "user");
        String second = jwtService.generateRefreshToken(userId, tenantId, "user");

        assertNotEquals(first, second);
    }
}
