package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Patient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {

    @Query("""
        SELECT p FROM Patient p
        WHERE p.tenantId = :tenantId
          AND p.deletedAt IS NULL
          AND (:filter IS NULL
               OR LOWER(p.firstName) LIKE :filter
               OR LOWER(p.lastName) LIKE :filter
               OR LOWER(COALESCE(p.documentNumber, '')) LIKE :filter)
        ORDER BY p.lastName ASC, p.firstName ASC
        """)
    Page<Patient> findByTenant(@Param("tenantId") UUID tenantId,
                               @Param("filter") String filter,
                               Pageable pageable);

    Optional<Patient> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);
}