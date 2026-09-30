package com.lta.gestdocum.usuarios.domain.repository;

import com.lta.gestdocum.usuarios.domain.model.ClinicalStaff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ClinicalStaffRepository extends JpaRepository<ClinicalStaff, UUID> {
    Optional<ClinicalStaff> findByUserIdAndTenantId(UUID userId, UUID tenantId);
    Optional<ClinicalStaff> findByUserIdAndTenantIdIsNull(UUID userId);
}
