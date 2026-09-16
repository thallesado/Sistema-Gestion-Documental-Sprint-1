package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByTenantIdAndNameContainingIgnoreCase(UUID tenantId, String name);

    List<Document> findByTenantIdAndNameContainingIgnoreCaseOrTenantIdAndDescriptionContainingIgnoreCase(
        UUID tenantId1, String name, UUID tenantId2, String description
    );

    Page<Document> findByTenantIdAndNameContainingIgnoreCase(UUID tenantId, String name, Pageable pageable);

    List<Document> findByTenantIdAndStatus(UUID tenantId, Document.DocumentStatus status);

    List<Document> findByTenantIdAndStatusAndDeletedAtIsNull(UUID tenantId, Document.DocumentStatus status);
}
