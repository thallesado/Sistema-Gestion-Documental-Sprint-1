package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.RevokedAccessToken;
import com.lta.gestdocum.backend.security.AccessTokenRevocationChecker;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.JwtService;
import io.jsonwebtoken.MalformedJwtException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Objects;

@Service
public class AccessTokenRevocationService implements AccessTokenRevocationChecker {
    private final JwtService jwtService;
    private final RevokedAccessTokenStore store;

    public AccessTokenRevocationService(JwtService jwtService, RevokedAccessTokenStore store) {
        this.jwtService = jwtService;
        this.store = store;
    }

    @Transactional
    public void revoke(AuthenticatedUser authenticatedUser, String token) {
        JwtService.AccessTokenDetails tokenDetails = jwtService.extractAccessTokenDetails(token);
        verifyIdentity(authenticatedUser, tokenDetails.identity());
        store.save(authenticatedUser, RevokedAccessToken.builder()
                .tokenHash(fingerprint(token))
                .userId(tokenDetails.identity().userId())
                .tenantId(tokenDetails.identity().tenantId())
                .expiresAt(tokenDetails.expiresAt())
                .revokedAt(OffsetDateTime.now(ZoneOffset.UTC))
                .build());
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isRevoked(AuthenticatedUser identity, String token) {
        JwtService.AccessTokenDetails tokenDetails = jwtService.extractAccessTokenDetails(token);
        verifyIdentity(identity, tokenDetails.identity());
        return store.hasActiveRevocation(identity, fingerprint(token), OffsetDateTime.now(ZoneOffset.UTC));
    }

    private void verifyIdentity(AuthenticatedUser authenticatedUser, AuthenticatedUser tokenIdentity) {
        if (!Objects.equals(authenticatedUser.userId(), tokenIdentity.userId())
                || !Objects.equals(authenticatedUser.tenantId(), tokenIdentity.tenantId())) {
            throw new AccessDeniedException("La identidad del token no coincide con la sesión autenticada");
        }
    }

    private String fingerprint(String token) {
        if (token == null || token.isBlank()) {
            throw new MalformedJwtException("El token de acceso está vacío");
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no está disponible", exception);
        }
    }
}
