package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Contract for the pending {@code revoked_access_tokens} incremental migration.
 * It stores only a SHA-256 token fingerprint, never the bearer credential itself.
 */
@Entity
@Table(name = "revoked_access_tokens", indexes = {
        @Index(name = "idx_revoked_access_tokens_expiry", columnList = "expires_at")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RevokedAccessToken {

    @Id
    @Column(name = "token_hash", nullable = false, updatable = false, length = 64)
    private String tokenHash;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "tenant_id", updatable = false)
    private UUID tenantId;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "revoked_at", nullable = false, updatable = false)
    private OffsetDateTime revokedAt;
}
