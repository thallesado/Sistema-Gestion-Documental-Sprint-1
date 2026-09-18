package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_versions")
@Getter
@Setter
public class DocumentVersion {
    @Id private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "document_id", nullable = false) private UUID documentId;
    @Column(name = "version_number", insertable = false, updatable = false) private Integer versionNumber;
    @Column(name = "author_id", nullable = false) private UUID authorId;
    @Column(name = "change_reason", nullable = false, length = 1000) private String changeReason;
    @Column(name = "file_path") private String filePath;
    @Column(name = "file_name", length = 255) private String fileName;
    @Column(name = "mime_type", length = 150) private String mimeType;
    @Column(name = "file_size_bytes", nullable = false) private long fileSizeBytes;
    @Column(name = "checksum_sha256", length = 64) private String checksumSha256;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
}
