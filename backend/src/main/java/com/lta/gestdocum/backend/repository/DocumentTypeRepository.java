package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.DocumentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentTypeRepository extends JpaRepository<DocumentType, UUID> {

    @Query("""
        SELECT d FROM DocumentType d
        WHERE d.tenantId = :tenantId
          AND (:active IS NULL OR d.active = :active)
          AND (:filter IS NULL OR LOWER(d.name) LIKE LOWER(CONCAT('%', :filter, '%'))
            OR LOWER(d.code) LIKE LOWER(CONCAT('%', :filter, '%')))
        """)
    Page<DocumentType> findByTenant(
            @Param("tenantId") UUID tenantId,
            @Param("filter") String filter,
            @Param("active") Boolean active,
            Pageable pageable);

    Optional<DocumentType> findByIdAndTenantId(UUID id, UUID tenantId);

    @Query("""
        SELECT COUNT(d) > 0 FROM DocumentType d
        WHERE d.tenantId = :tenantId AND (:excludedId IS NULL OR d.id <> :excludedId)
          AND (LOWER(d.code) = LOWER(:code) OR LOWER(d.name) = LOWER(:name))
        """)
    boolean existsDuplicate(
            @Param("tenantId") UUID tenantId,
            @Param("code") String code,
            @Param("name") String name,
            @Param("excludedId") UUID excludedId);
}
