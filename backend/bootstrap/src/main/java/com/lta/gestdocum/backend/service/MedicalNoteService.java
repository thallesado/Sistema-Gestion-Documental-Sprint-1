package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.MedicalNoteRequest;
import com.lta.gestdocum.backend.dto.MedicalNoteResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import com.lta.gestdocum.backend.model.MedicalNote;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.MedicalNoteRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class MedicalNoteService {
    private final MedicalNoteRepository repository;
    private final ClinicalHistoryRepository historyRepository;
    private final AuthenticatedUserContext userContext;

    public MedicalNoteService(MedicalNoteRepository repository, ClinicalHistoryRepository historyRepository,
                              AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.historyRepository = historyRepository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<MedicalNoteResponse> find(UUID clinicalHistoryId, Pageable pageable) {
        return find(clinicalHistoryId, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<MedicalNoteResponse> find(UUID clinicalHistoryId, DocumentStatus status, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        requireHistory(clinicalHistoryId, tenantId);
        if (status != null) {
            return repository.findByTenantIdAndClinicalHistoryIdAndStatusOrderByCreatedAtDesc(tenantId, clinicalHistoryId, status, pageable)
                    .map(this::toResponse);
        }
        return repository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(tenantId, clinicalHistoryId, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public MedicalNoteResponse create(MedicalNoteRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        requireHistory(request.clinicalHistoryId(), tenantId);
        DocumentStatus initialStatus = request.status() != null ? request.status() : DocumentStatus.DRAFT;
        MedicalNote note = MedicalNote.builder()
                .tenantId(tenantId)
                .clinicalHistoryId(request.clinicalHistoryId())
                .episodeId(request.episodeId())
                .authorId(userContext.requireUserId())
                .noteType(request.noteType().trim())
                .content(request.content().trim())
                .status(initialStatus)
                .createdAt(OffsetDateTime.now())
                .build();
        return toResponse(repository.save(note));
    }

    @Transactional
    public MedicalNoteResponse transition(UUID id, DocumentStatus targetStatus) {
        if (targetStatus == null) {
            throw new IllegalArgumentException("El estado destino no puede ser nulo");
        }
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        MedicalNote note = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Nota médica no encontrada"));

        DocumentStatus currentStatus = note.getStatus() != null ? note.getStatus() : DocumentStatus.DRAFT;

        // Regla HU-09: Solo transiciones desde DRAFT a APPROVED o VOIDED
        if (currentStatus != DocumentStatus.DRAFT ||
                (targetStatus != DocumentStatus.APPROVED && targetStatus != DocumentStatus.VOIDED)) {
            throw new IllegalStateException(
                    String.format("Transición de estado inválida: no se permite pasar de %s a %s", currentStatus, targetStatus)
            );
        }

        note.setStatus(targetStatus);
        return toResponse(repository.save(note));
    }

    private ClinicalHistory requireHistory(UUID id, UUID tenantId) {
        return historyRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Historia clínica no encontrada"));
    }

    private MedicalNoteResponse toResponse(MedicalNote note) {
        DocumentStatus status = note.getStatus() != null ? note.getStatus() : DocumentStatus.DRAFT;
        return new MedicalNoteResponse(note.getId(), note.getClinicalHistoryId(), note.getEpisodeId(),
                note.getAuthorId(), note.getNoteType(), note.getContent(), status, note.getCreatedAt());
    }
}
