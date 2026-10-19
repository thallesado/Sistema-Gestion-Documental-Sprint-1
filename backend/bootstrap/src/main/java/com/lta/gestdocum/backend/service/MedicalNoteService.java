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
import com.lta.gestdocum.backend.security.HtmlSanitizerService;
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
    private final HtmlSanitizerService sanitizer;
    private final ComponentPermissionService componentPermissions;

    /** Tipo que se asigna cuando el perfil no puede elegirlo (privilegios B2). */
    static final String DEFAULT_NOTE_TYPE = "EVOLUTION";

    public MedicalNoteService(MedicalNoteRepository repository, ClinicalHistoryRepository historyRepository,
                              AuthenticatedUserContext userContext, HtmlSanitizerService sanitizer,
                              ComponentPermissionService componentPermissions) {
        this.repository = repository;
        this.historyRepository = historyRepository;
        this.userContext = userContext;
        this.sanitizer = sanitizer;
        this.componentPermissions = componentPermissions;
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
        ComponentFormAccess access = noteAccess();
        if (status != null) {
            return repository.findByTenantIdAndClinicalHistoryIdAndStatusOrderByCreatedAtDesc(tenantId, clinicalHistoryId, status, pageable)
                    .map(note -> toResponse(note, access));
        }
        return repository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(tenantId, clinicalHistoryId, pageable)
                .map(note -> toResponse(note, access));
    }

    @Transactional
    public MedicalNoteResponse create(MedicalNoteRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        requireHistory(request.clinicalHistoryId(), tenantId);
        ComponentFormAccess access = noteAccess();
        access.requireUnchanged("tipo", DEFAULT_NOTE_TYPE, request.noteType());
        access.requireUnchanged("estado", DocumentStatus.DRAFT, request.status());
        access.requireEditableIfProvided("contenido", request.content());
        DocumentStatus initialStatus = request.status() != null ? request.status() : DocumentStatus.DRAFT;
        String rawContent = request.content() != null ? request.content().trim() : "";
        String cleanContent = sanitizer.sanitize(rawContent);
        if (cleanContent.isBlank()) {
            throw new IllegalArgumentException("El contenido de la nota médica no puede quedar vacío tras la sanitización");
        }
        MedicalNote note = MedicalNote.builder()
                .tenantId(tenantId)
                .clinicalHistoryId(request.clinicalHistoryId())
                .episodeId(request.episodeId())
                .authorId(userContext.requireUserId())
                .noteType(access.editable("tipo") ? request.noteType().trim() : DEFAULT_NOTE_TYPE)
                .content(cleanContent)
                .status(initialStatus)
                .createdAt(OffsetDateTime.now())
                .build();
        return toResponse(repository.save(note), access);
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
        ComponentFormAccess access = noteAccess();
        access.requireUnchanged("estado", currentStatus, targetStatus);

        // Regla HU-09: Solo transiciones desde DRAFT a APPROVED o VOIDED
        if (currentStatus != DocumentStatus.DRAFT ||
                (targetStatus != DocumentStatus.APPROVED && targetStatus != DocumentStatus.VOIDED)) {
            throw new IllegalStateException(
                    String.format("Transición de estado inválida: no se permite pasar de %s a %s", currentStatus, targetStatus)
            );
        }

        note.setStatus(targetStatus);
        return toResponse(repository.save(note), access);
    }

    private ClinicalHistory requireHistory(UUID id, UUID tenantId) {
        return historyRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Historia clínica no encontrada"));
    }

    private ComponentFormAccess noteAccess() {
        return componentPermissions.current(ComponentFormCatalog.MEDICAL_NOTE_FORM);
    }

    /** Los componentes ocultos para el perfil no se devuelven (privilegios B2). */
    private MedicalNoteResponse toResponse(MedicalNote note, ComponentFormAccess access) {
        DocumentStatus status = note.getStatus() != null ? note.getStatus() : DocumentStatus.DRAFT;
        return new MedicalNoteResponse(note.getId(), note.getClinicalHistoryId(), note.getEpisodeId(),
                note.getAuthorId(), access.reveal("tipo", note.getNoteType()), access.reveal("contenido", note.getContent()),
                access.reveal("estado", status), note.getCreatedAt());
    }
}
