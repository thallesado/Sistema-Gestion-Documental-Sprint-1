package com.lta.gestdocum.tablero.application.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DashboardTaskResponse(
        UUID id,
        UUID documentId,
        String title,
        String status,
        Integer priority,
        OffsetDateTime dueAt) {
}
