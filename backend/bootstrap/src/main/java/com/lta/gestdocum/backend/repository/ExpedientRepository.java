package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Expedient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExpedientRepository extends JpaRepository<Expedient, UUID> {

    @Query("""
        SELECT e FROM Expedient e
        WHERE e.tenantId = :tenantId
          AND e.deletedAt IS NULL
          AND (:filter IS NULL
               OR LOWER(e.code) LIKE :filter
               OR LOWER(e.name) LIKE :filter
               OR LOWER(COALESCE(e.description, '')) LIKE :filter)
        ORDER BY e.updatedAt DESC, e.id DESC
        """)
    Page<Expedient> findByTenant(@Param("tenantId") UUID tenantId,
                                 @Param("filter") String filter,
                                 Pageable pageable);

    Optional<Expedient> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);
}
