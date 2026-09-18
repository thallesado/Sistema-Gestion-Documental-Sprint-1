package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.MedicalNoteRequest;
import com.lta.gestdocum.backend.dto.MedicalNoteResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.ClinicalHistory;
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
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        requireHistory(clinicalHistoryId, tenantId);
        return repository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(tenantId, clinicalHistoryId, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public MedicalNoteResponse create(MedicalNoteRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        requireHistory(request.clinicalHistoryId(), tenantId);
        MedicalNote note = MedicalNote.builder()
                .tenantId(tenantId)
                .clinicalHistoryId(request.clinicalHistoryId())
                .episodeId(request.episodeId())
                .authorId(userContext.requireUserId())
                .noteType(request.noteType().trim())
                .content(request.content().trim())
                .createdAt(OffsetDateTime.now())
                .build();
        return toResponse(repository.save(note));
    }

    private ClinicalHistory requireHistory(UUID id, UUID tenantId) {
        return historyRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Historia clínica no encontrada"));
    }

    private MedicalNoteResponse toResponse(MedicalNote note) {
        return new MedicalNoteResponse(note.getId(), note.getClinicalHistoryId(), note.getEpisodeId(),
                note.getAuthorId(), note.getNoteType(), note.getContent(), note.getCreatedAt());
    }
}
