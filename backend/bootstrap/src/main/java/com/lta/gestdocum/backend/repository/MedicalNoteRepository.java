package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import com.lta.gestdocum.backend.model.MedicalNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface MedicalNoteRepository extends JpaRepository<MedicalNote, UUID> {
    Optional<MedicalNote> findByIdAndTenantId(UUID id, UUID tenantId);

    List<MedicalNote> findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(
            UUID tenantId, UUID clinicalHistoryId);

    Page<MedicalNote> findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(
            UUID tenantId, UUID clinicalHistoryId, Pageable pageable);

    Page<MedicalNote> findByTenantIdAndClinicalHistoryIdAndStatusOrderByCreatedAtDesc(
            UUID tenantId, UUID clinicalHistoryId, DocumentStatus status, Pageable pageable);
}
