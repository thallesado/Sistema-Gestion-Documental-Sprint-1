package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.lta.gestdocum.backend.model.AuditEvent;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AuditEventResponse(
        Long id,
        UUID tenantId,
        UUID userId,
        UUID platformActorId,
        String action,
        String entityType,
        UUID entityId,
        @JsonFormat(shape = JsonFormat.Shape.STRING) OffsetDateTime occurredAt,
        String result,
        String ipAddress,
        String userAgent,
        AuditActorResponse actor,
        AuditResourceResponse resource
) {
    public static AuditEventResponse from(AuditEvent event) {
        AuditActorResponse actor = event.getPlatformActorId() != null
                ? new AuditActorResponse(event.getPlatformActorId(), "PLATFORM")
                : event.getUserId() == null ? null : new AuditActorResponse(event.getUserId(), "TENANT");
        return new AuditEventResponse(
                event.getId(), event.getTenantId(), event.getUserId(), event.getPlatformActorId(),
                event.getAction(), event.getEntityType(), event.getEntityId(), event.getOccurredAt(),
                event.getResult(),
                event.getIpAddress() == null ? null : event.getIpAddress().getHostAddress(),
                event.getUserAgent(), actor,
                new AuditResourceResponse(event.getEntityType(), event.getEntityId()));
    }
}
