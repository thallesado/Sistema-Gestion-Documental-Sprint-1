package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AuditVerificationResult(
        boolean valid,
        UUID tenantId,
        long totalVerified,
        Long brokenChainSeq,
        Long brokenRecordId,
        String failureReason,
        String expectedHash,
        String actualHash,
        ExternalAnchorStatus externalAnchorStatus,
        @JsonFormat(shape = JsonFormat.Shape.STRING) OffsetDateTime verifiedAt
) {
    public record ExternalAnchorStatus(
            boolean anchored,
            Long anchoredChainSeq,
            String anchoredRecordHash,
            boolean anchorMatchesChain,
            String anchorType,
            String anchorReference,
            @JsonFormat(shape = JsonFormat.Shape.STRING) OffsetDateTime anchoredAt,
            /** ANCHORED_MATCH, ANCHOR_MISMATCH, ANCHOR_SIGNATURE_INVALID, NO_EXTERNAL_ANCHOR, UNREACHABLE, UNVERIFIABLE, NOT_CONFIGURED. */
            String status,
            String detail,
            boolean externalConfigured,
            String destination
    ) {
        /** Legacy shape (internal anchor only): no external destination is involved. */
        public ExternalAnchorStatus(boolean anchored, Long anchoredChainSeq, String anchoredRecordHash,
                                    boolean anchorMatchesChain, String anchorType, String anchorReference,
                                    OffsetDateTime anchoredAt) {
            this(anchored, anchoredChainSeq, anchoredRecordHash, anchorMatchesChain, anchorType, anchorReference,
                    anchoredAt, "NOT_CONFIGURED", null, false, null);
        }
    }
}
