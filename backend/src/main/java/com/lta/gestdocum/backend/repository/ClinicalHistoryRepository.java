package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.ClinicalHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicalHistoryRepository extends JpaRepository<ClinicalHistory, UUID> {

    @Query("""
        SELECT ch FROM ClinicalHistory ch
        WHERE ch.tenantId = :tenantId
          AND (:patientId IS NULL OR ch.patientId = :patientId)
          AND (:filter IS NULL OR LOWER(ch.code) LIKE :filter)
        ORDER BY ch.createdAt DESC
        """)
    Page<ClinicalHistory> findByTenant(@Param("tenantId") UUID tenantId,
                                       @Param("patientId") UUID patientId,
                                       @Param("filter") String filter,
                                       Pageable pageable);

    Optional<ClinicalHistory> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndCode(UUID tenantId, String code);
}