package com.lta.gestdocum.backend.modulos.tablero.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DashboardActivityResponse(
        Long id,
        UUID userId,
        String actorName,
        String action,
        String entityType,
        UUID entityId,
        OffsetDateTime occurredAt,
        String result) {
}
