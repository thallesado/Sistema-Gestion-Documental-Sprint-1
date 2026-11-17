package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.exception.InvalidCredentialsException;
import com.lta.gestdocum.backend.model.AuthSession;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.AuthSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class AuthSessionService {
    private final AuthSessionRepository repository;
    private final JdbcTemplate jdbc;

    public AuthSessionService(AuthSessionRepository repository, JdbcTemplate jdbc) {
        this.repository = repository;
        this.jdbc = jdbc;
    }

    @Transactional
    public void issue(User user, String refreshToken, long lifetimeMillis) {
        establishContext(user.getTenantId(), user.getId());
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        repository.save(AuthSession.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .tenantId(user.getTenantId())
                .refreshTokenHash(hash(refreshToken))
                .createdAt(now)
                .expiresAt(now.plusNanos(lifetimeMillis * 1_000_000))
                .build());
    }

    @Transactional
    public void rotate(User user, String currentToken, String replacementToken, long lifetimeMillis) {
        establishContext(user.getTenantId(), user.getId());
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        AuthSession current = repository.findByRefreshTokenHash(hash(currentToken))
                .orElseThrow(InvalidCredentialsException::new);
        if (current.getRevokedAt() != null || !current.getExpiresAt().isAfter(now)
                || !current.getUserId().equals(user.getId())
                || !java.util.Objects.equals(current.getTenantId(), user.getTenantId())) {
            repository.revokeAllByUserId(user.getId(), now);
            throw new InvalidCredentialsException();
        }

        AuthSession replacement = AuthSession.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .tenantId(user.getTenantId())
                .refreshTokenHash(hash(replacementToken))
                .createdAt(now)
                .expiresAt(now.plusNanos(lifetimeMillis * 1_000_000))
                .build();
        repository.save(replacement);
        current.setLastUsedAt(now);
        current.setRevokedAt(now);
        current.setReplacedBy(replacement.getId());
        repository.save(current);
    }

    @Transactional
    public void revoke(com.lta.gestdocum.backend.security.AuthenticatedUser user, String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) return;
        establishContext(user.tenantId(), user.userId());
        repository.findByRefreshTokenHash(hash(refreshToken)).ifPresent(session -> {
            if (session.getRevokedAt() == null) {
                session.setRevokedAt(OffsetDateTime.now(ZoneOffset.UTC));
                repository.save(session);
            }
        });
    }

    @Transactional
    public void revokeAll(UUID userId) {
        jdbc.execute("SET LOCAL ROLE nexodocs_app");
        repository.revokeAllByUserId(userId, OffsetDateTime.now(ZoneOffset.UTC));
    }

    @Transactional(readOnly = true)
    public boolean hasActiveSession(UUID userId) {
        return repository.existsByUserIdAndRevokedAtIsNullAndExpiresAtAfter(userId, OffsetDateTime.now(ZoneOffset.UTC));
    }

    static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no está disponible", exception);
        }
    }

    private void establishContext(UUID tenantId, UUID userId) {
        jdbc.execute("SET LOCAL ROLE nexodocs_app");
        jdbc.queryForMap("SELECT set_config('app.tenant_id', ?, true), set_config('app.user_id', ?, true)",
                tenantId == null ? "" : tenantId.toString(), userId.toString());
    }
}
