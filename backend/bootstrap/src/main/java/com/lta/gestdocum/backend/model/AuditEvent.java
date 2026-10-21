package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.net.InetAddress;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "platform_actor_id")
    private UUID platformActorId;

    private String action;

    @Column(name = "entity_type")
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "occurred_at")
    private OffsetDateTime occurredAt;

    private String result;

    @JdbcTypeCode(SqlTypes.INET)
    @Column(name = "ip_address")
    private InetAddress ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details", columnDefinition = "jsonb")
    private String details;

    @Column(name = "client_timestamp")
    private OffsetDateTime clientTimestamp;

    @Column(name = "client_timezone")
    private String clientTimezone;

    @Column(name = "chain_seq")
    private Long chainSeq;

    // 041_audit_tamper_proof crea el hash como character(64); sin CHAR, ddl-auto=validate impide arrancar.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "previous_hash", length = 64)
    private String previousHash;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "record_hash", length = 64)
    private String recordHash;
}
