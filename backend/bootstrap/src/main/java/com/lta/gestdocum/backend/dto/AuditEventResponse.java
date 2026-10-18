package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonRawValue;
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
        @JsonFormat(shape = JsonFormat.Shape.STRING) OffsetDateTime clientTimestamp,
        String clientTimezone,
        String result,
        String ipAddress,
        String userAgent,
        AuditActorResponse actor,
        AuditResourceResponse resource,
        @JsonRawValue String details
) {
    public static AuditEventResponse from(AuditEvent event) {
        AuditActorResponse actor = event.getPlatformActorId() != null
                ? new AuditActorResponse(event.getPlatformActorId(), "PLATFORM")
                : event.getUserId() == null ? null : new AuditActorResponse(event.getUserId(), "TENANT");
        String detailsRaw = (event.getDetails() == null || event.getDetails().isBlank()) ? "{}" : event.getDetails();
        return new AuditEventResponse(
                event.getId(), event.getTenantId(), event.getUserId(), event.getPlatformActorId(),
                event.getAction(), event.getEntityType(), event.getEntityId(), event.getOccurredAt(),
                event.getClientTimestamp(), event.getClientTimezone(),
                event.getResult(),
                event.getIpAddress() == null ? null : event.getIpAddress().getHostAddress(),
                event.getUserAgent(), actor,
                new AuditResourceResponse(event.getEntityType(), event.getEntityId()),
                detailsRaw);
    }
}
