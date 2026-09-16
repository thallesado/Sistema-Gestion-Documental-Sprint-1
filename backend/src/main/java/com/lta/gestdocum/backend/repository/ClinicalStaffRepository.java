package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.ClinicalStaff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicalStaffRepository extends JpaRepository<ClinicalStaff, UUID> {
    Optional<ClinicalStaff> findByUserIdAndTenantId(UUID userId, UUID tenantId);

    Optional<ClinicalStaff> findByUserIdAndTenantIdIsNull(UUID userId);
}
