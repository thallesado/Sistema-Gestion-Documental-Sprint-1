package com.lta.gestdocum.backend.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PublicRadicacionResponse(
        String code,
        UUID tenantId,
        String tenantName,
        String subject,
        String type,
        String status,
        String statusLabel,
        String citizenName,
        OffsetDateTime createdAt,
        String verificationHash,
        String summary,
        List<PublicRadicacionEvent> events) {

    public record PublicRadicacionEvent(
            String stageName,
            String description,
            OffsetDateTime timestamp,
            String status) {
    }
}
