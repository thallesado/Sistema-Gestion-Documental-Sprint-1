package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Auditable commercial lead created from the Enterprise subscription contact page. */
@Entity
@Table(name = "enterprise_inquiries")
public class EnterpriseInquiry {
    @Id @GeneratedValue private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "organization_name", nullable = false, length = 255) private String organizationName;
    @Column(name = "contact_name", nullable = false, length = 160) private String contactName;
    @Column(nullable = false, length = 254) private String email;
    @Column(length = 60) private String phone;
    @Column(name = "estimated_users", nullable = false) private int estimatedUsers;
    @Column(name = "requires_dicom", nullable = false) private boolean dicom;
    @Column(name = "requires_bulk_ocr", nullable = false) private boolean bulkOcr;
    @Column(name = "requires_interoperability", nullable = false) private boolean interoperability;
    @Column(length = 4000) private String message;
    @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;

    protected EnterpriseInquiry() { }

    public EnterpriseInquiry(UUID tenantId, UUID userId, String organizationName, String contactName,
                             String email, String phone, int estimatedUsers, boolean dicom,
                             boolean bulkOcr, boolean interoperability, String message) {
        this.tenantId = tenantId; this.userId = userId; this.organizationName = organizationName;
        this.contactName = contactName; this.email = email; this.phone = phone; this.estimatedUsers = estimatedUsers;
        this.dicom = dicom; this.bulkOcr = bulkOcr; this.interoperability = interoperability; this.message = message;
    }

    @PrePersist void initializeCreatedAt() { if (createdAt == null) createdAt = OffsetDateTime.now(); }
    public UUID getId() { return id; }
}
