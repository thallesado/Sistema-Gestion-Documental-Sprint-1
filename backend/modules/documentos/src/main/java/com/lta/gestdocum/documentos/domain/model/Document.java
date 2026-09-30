package com.lta.gestdocum.documentos.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
public class Document {

    @Id
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "expedient_id")
    private UUID expedientId;

    @Column(name = "document_type_id", nullable = false)
    private UUID documentTypeId;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "responsible_id")
    private UUID responsibleId;

    @Column(name = "department_id")
    private UUID departmentId;

    @Column(name = "code", nullable = false)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "document_status")
    private DocumentStatus status;

    @Column(name = "current_version")
    private Integer currentVersion;

    @Column(name = "is_external_source")
    private Boolean isExternalSource;

    @Column(name = "source")
    private String source;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "archived_at")
    private OffsetDateTime archivedAt;

    @Column(name = "voided_at")
    private OffsetDateTime voidedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Document(UUID tenantId, UUID documentTypeId, UUID authorId, String code, String name) {
        this.tenantId = tenantId;
        this.documentTypeId = documentTypeId;
        this.authorId = authorId;
        this.code = code;
        this.name = name;
        this.status = DocumentStatus.DRAFT;
    }
}
