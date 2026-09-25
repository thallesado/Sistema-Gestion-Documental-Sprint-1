package com.lta.gestdocum.backend.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DashboardDocumentResponse(
        UUID id,
        UUID expedientId,
        String code,
        String name,
        String status,
        OffsetDateTime updatedAt) {
}
