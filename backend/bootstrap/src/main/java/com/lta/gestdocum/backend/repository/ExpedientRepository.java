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
          AND (lower(e.code) LIKE lower(concat('%', :filter, '%'))
               OR lower(e.name) LIKE lower(concat('%', :filter, '%'))
               OR lower(coalesce(e.description, '')) LIKE lower(concat('%', :filter, '%')))
        ORDER BY e.updatedAt DESC, e.id DESC
        """)
    Page<Expedient> searchByTenant(@Param("tenantId") UUID tenantId,
                                   @Param("filter") String filter,
                                   Pageable pageable);

    @Query("""
        SELECT e FROM Expedient e
        WHERE e.tenantId = :tenantId
          AND e.deletedAt IS NULL
          AND e.status = :status
          AND (lower(e.code) LIKE lower(concat('%', :filter, '%'))
               OR lower(e.name) LIKE lower(concat('%', :filter, '%'))
               OR lower(coalesce(e.description, '')) LIKE lower(concat('%', :filter, '%')))
        ORDER BY e.updatedAt DESC, e.id DESC
        """)
    Page<Expedient> searchByTenantAndStatus(@Param("tenantId") UUID tenantId,
                                           @Param("status") Expedient.ExpedientStatus status,
                                           @Param("filter") String filter,
                                           Pageable pageable);

    default Page<Expedient> findByTenant(UUID tenantId, String filter, Pageable pageable) {
        return searchByTenant(tenantId, filter == null ? "" : filter.trim(), pageable);
    }

    default Page<Expedient> findByTenantAndStatus(UUID tenantId, Expedient.ExpedientStatus status, String filter, Pageable pageable) {
        if (status != null) {
            return searchByTenantAndStatus(tenantId, status, filter == null ? "" : filter.trim(), pageable);
        }
        return searchByTenant(tenantId, filter == null ? "" : filter.trim(), pageable);
    }

    Optional<Expedient> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);
}
