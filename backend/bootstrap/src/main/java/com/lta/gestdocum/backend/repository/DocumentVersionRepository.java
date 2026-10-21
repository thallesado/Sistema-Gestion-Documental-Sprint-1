package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {
    List<DocumentVersion> findByTenantIdAndDocumentIdOrderByVersionNumberDesc(UUID tenantId, UUID documentId);
    Optional<DocumentVersion> findByIdAndTenantId(UUID id, UUID tenantId);

    @Query("select coalesce(sum(v.fileSizeBytes), 0) from DocumentVersion v where v.tenantId = :tenantId")
    long sumFileSizeBytesByTenantId(@Param("tenantId") UUID tenantId);
}
