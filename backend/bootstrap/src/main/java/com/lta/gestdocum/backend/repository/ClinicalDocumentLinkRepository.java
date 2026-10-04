package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.ClinicalDocumentLink;
import com.lta.gestdocum.backend.model.ClinicalDocumentLinkId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ClinicalDocumentLinkRepository extends JpaRepository<ClinicalDocumentLink, ClinicalDocumentLinkId> {

    List<ClinicalDocumentLink> findByTenantIdAndClinicalHistoryId(UUID tenantId, UUID clinicalHistoryId);

    Optional<ClinicalDocumentLink> findByTenantIdAndClinicalHistoryIdAndIdDocumentId(
            UUID tenantId, UUID clinicalHistoryId, UUID documentId);

    void deleteByTenantIdAndClinicalHistoryIdAndIdDocumentId(
            UUID tenantId, UUID clinicalHistoryId, UUID documentId);

    boolean existsByTenantIdAndClinicalHistoryIdAndIdDocumentId(
            UUID tenantId, UUID clinicalHistoryId, UUID documentId);
}
