package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.RevokedAccessToken;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.JwtService;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccessTokenRevocationServiceTest {
    private final JwtService jwtService = new JwtService("01234567890123456789012345678901", 3_600_000);
    private final InMemoryRevokedAccessTokenStore store = new InMemoryRevokedAccessTokenStore();
    private final AccessTokenRevocationService service =
            new AccessTokenRevocationService(jwtService, store);

    @Test
    void persistsFingerprintAndBlocksTheMatchingAccessToken() {
        AuthenticatedUser identity = identity();
        String token = jwtService.generateToken(
                identity.userId(), identity.tenantId(), identity.username(), identity.authorities());

        service.revoke(identity, token);

        assertTrue(service.isRevoked(identity, token));
        RevokedAccessToken persisted = store.onlyRecord();
        assertNotEquals(token, persisted.getTokenHash());
        assertEquals(64, persisted.getTokenHash().length());
        assertEquals(identity.userId(), persisted.getUserId());
        assertEquals(identity.tenantId(), persisted.getTenantId());
    }

    @Test
    void ignoresAnExpiredRevocationRecord() {
        AuthenticatedUser identity = identity();
        String token = jwtService.generateToken(
                identity.userId(), identity.tenantId(), identity.username(), identity.authorities());

        service.revoke(identity, token);
        store.expireAll();

        assertFalse(service.isRevoked(identity, token));
    }

    private AuthenticatedUser identity() {
        return new AuthenticatedUser(
                UUID.randomUUID(), UUID.randomUUID(), "auditor", Set.of("audit:read_tenant"));
    }

    private static final class InMemoryRevokedAccessTokenStore implements RevokedAccessTokenStore {
        private final Map<String, RevokedAccessToken> tokens = new HashMap<>();

        @Override
        public boolean hasActiveRevocation(AuthenticatedUser identity, String tokenHash, OffsetDateTime now) {
            RevokedAccessToken record = tokens.get(tokenHash);
            return record != null && record.getExpiresAt().isAfter(now);
        }

        @Override
        public void save(AuthenticatedUser identity, RevokedAccessToken revokedToken) {
            tokens.put(revokedToken.getTokenHash(), revokedToken);
        }

        private RevokedAccessToken onlyRecord() {
            return tokens.values().iterator().next();
        }

        private void expireAll() {
            tokens.replaceAll((hash, record) -> RevokedAccessToken.builder()
                    .tokenHash(record.getTokenHash())
                    .userId(record.getUserId())
                    .tenantId(record.getTenantId())
                    .expiresAt(OffsetDateTime.now().minusMinutes(1))
                    .revokedAt(record.getRevokedAt())
                    .build());
        }
    }
}
