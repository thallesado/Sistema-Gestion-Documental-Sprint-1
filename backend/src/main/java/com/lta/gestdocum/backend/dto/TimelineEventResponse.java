package com.lta.gestdocum.backend.dto;

import lombok.Builder;
import lombok.Value;
import java.time.OffsetDateTime;
import java.util.UUID;

@Value @Builder
public class TimelineEventResponse {
    OffsetDateTime occurredAt;
    String eventType;
    String code;
    String status;
    UUID referenceId;
    String description;
}
