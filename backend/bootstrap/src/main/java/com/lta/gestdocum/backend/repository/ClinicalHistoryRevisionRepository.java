package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.ClinicalHistoryRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicalHistoryRevisionRepository extends JpaRepository<ClinicalHistoryRevision, UUID> {

    List<ClinicalHistoryRevision> findByTenantIdAndClinicalHistoryIdOrderByRevisionNumberDesc(UUID tenantId, UUID clinicalHistoryId);

    Optional<ClinicalHistoryRevision> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndClinicalHistoryId(UUID tenantId, UUID clinicalHistoryId);
}
