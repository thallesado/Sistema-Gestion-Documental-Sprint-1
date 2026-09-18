package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity @Table(name="audit_events")
@Getter
public class AuditEvent {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    private UUID tenantId;
    private UUID userId;
    private String action;
    private String entityType;
    private UUID entityId;
    private OffsetDateTime occurredAt;
    private String result;
}
