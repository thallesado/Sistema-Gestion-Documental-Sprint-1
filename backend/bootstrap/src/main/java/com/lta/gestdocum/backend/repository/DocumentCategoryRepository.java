package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.DocumentCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentCategoryRepository extends JpaRepository<DocumentCategory, UUID> {
    List<DocumentCategory> findByTenantIdAndActiveIsTrueOrderByNameAsc(UUID tenantId);
    Optional<DocumentCategory> findByIdAndTenantId(UUID id, UUID tenantId);
}
