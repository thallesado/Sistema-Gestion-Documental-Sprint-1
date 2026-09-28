package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.MedicalNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.List;

public interface MedicalNoteRepository extends JpaRepository<MedicalNote, UUID> {
    List<MedicalNote> findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(
            UUID tenantId, UUID clinicalHistoryId);
    Page<MedicalNote> findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(
            UUID tenantId, UUID clinicalHistoryId, Pageable pageable);
}
