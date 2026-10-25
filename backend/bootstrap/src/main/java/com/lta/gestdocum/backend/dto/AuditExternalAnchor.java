package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.lta.gestdocum.backend.model.AuditAnchor;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Signed anchor as published outside the database. One JSON line per anchor.
 * The signature is the same HMAC the internal anchor carries (see AuditAnchorService).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AuditExternalAnchor(
        int version,
        String scope,
        UUID tenantId,
        long chainSeq,
        String recordHash,
        String anchorType,
        String anchorReference,
        String signature,
        long anchoredAtMs,
        UUID anchoredBy
) {
    public static String scopeOf(UUID tenantId) {
        return tenantId == null ? "global" : tenantId.toString();
    }

    public static AuditExternalAnchor from(AuditAnchor a) {
        return new AuditExternalAnchor(1, scopeOf(a.getTenantId()), a.getTenantId(), a.getChainSeq(),
                a.getRecordHash() == null ? null : a.getRecordHash().trim(), a.getAnchorType(),
                a.getAnchorReference(), a.getSignature(), a.getAnchoredAt().toInstant().toEpochMilli(),
                a.getAnchoredBy());
    }

    /** Rebuilds the entity shape so the HMAC can be re-verified with AuditAnchorService. */
    public AuditAnchor toAnchor() {
        return AuditAnchor.builder()
                .tenantId(tenantId)
                .chainSeq(chainSeq)
                .recordHash(recordHash)
                .anchorType(anchorType)
                .anchorReference(anchorReference)
                .signature(signature)
                .anchoredAt(Instant.ofEpochMilli(anchoredAtMs).atOffset(ZoneOffset.UTC))
                .anchoredBy(anchoredBy)
                .build();
    }
}
