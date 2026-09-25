package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.Expedient;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record ExpedientResponse(
        UUID id,
        UUID expedientTypeId,
        UUID responsibleId,
        UUID departmentId,
        String code,
        String name,
        String description,
        Expedient.ExpedientStatus status,
        Map<String, Object> metadata,
        OffsetDateTime closedAt,
        OffsetDateTime archivedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
