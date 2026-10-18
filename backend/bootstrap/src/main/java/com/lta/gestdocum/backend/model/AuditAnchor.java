package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_anchors")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditAnchor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "chain_seq", nullable = false)
    private Long chainSeq;

    @Column(name = "record_hash", nullable = false, length = 64)
    private String recordHash;

    @Column(name = "anchor_type", nullable = false, length = 50)
    private String anchorType;

    @Column(name = "anchor_reference", nullable = false)
    private String anchorReference;

    @Column(name = "signature")
    private String signature;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "anchored_at", nullable = false)
    private OffsetDateTime anchoredAt;

    @Column(name = "anchored_by")
    private UUID anchoredBy;
}
