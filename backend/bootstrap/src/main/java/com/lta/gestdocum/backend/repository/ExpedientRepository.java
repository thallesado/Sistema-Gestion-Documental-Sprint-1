package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Expedient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ExpedientRepository extends JpaRepository<Expedient, UUID> {

    @Query("""
        SELECT e FROM Expedient e
        WHERE e.tenantId = :tenantId
          AND e.deletedAt IS NULL
          AND (:status IS NULL OR e.status = :status)
          AND (:filter IS NULL
               OR LOWER(e.code) LIKE :filter
               OR LOWER(e.name) LIKE :filter
               OR LOWER(COALESCE(e.description, '')) LIKE :filter)
        ORDER BY e.updatedAt DESC, e.id DESC
        """)
    Page<Expedient> findByTenantAndStatus(@Param("tenantId") UUID tenantId,
                                         @Param("status") Expedient.ExpedientStatus status,
                                         @Param("filter") String filter,
                                         Pageable pageable);

    default Page<Expedient> findByTenant(UUID tenantId, String filter, Pageable pageable) {
        return findByTenantAndStatus(tenantId, null, filter, pageable);
    }

    Optional<Expedient> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);
}
