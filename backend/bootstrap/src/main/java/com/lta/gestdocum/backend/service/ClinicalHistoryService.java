package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.ClinicalHistoryRequest;
import com.lta.gestdocum.backend.dto.ClinicalHistoryResponse;
import com.lta.gestdocum.backend.dto.ClinicalHistoryRevisionResponse;
import com.lta.gestdocum.backend.dto.DeleteClinicalHistoryRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.dto.TimelineEventResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.*;
import com.lta.gestdocum.backend.repository.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ClinicalHistoryService {

    private static final String CODE_PREFIX = "HC-";

    private final ClinicalHistoryRepository repository;
    private final PatientService patientService;
    private final AuthenticatedUserContext userContext;
    private final ClinicalEpisodeRepository episodeRepository;
    private final MedicalNoteRepository medicalNoteRepository;
    private final DocumentRepository documentRepository;
    private final AuditEventRepository auditEventRepository;
    private final ClinicalDocumentLinkRepository clinicalDocumentLinkRepository;
    private final ClinicalHistoryRevisionRepository revisionRepository;
    private final UserRepository userRepository;
    private final ClinicalStaffRepository clinicalStaffRepository;
    private final ObjectMapper objectMapper;
    @Autowired
    public ClinicalHistoryService(
            ClinicalHistoryRepository repository,
            PatientService patientService,
            AuthenticatedUserContext userContext,
            ClinicalEpisodeRepository episodeRepository,
            MedicalNoteRepository medicalNoteRepository,
            DocumentRepository documentRepository,
            AuditEventRepository auditEventRepository,
            ClinicalDocumentLinkRepository clinicalDocumentLinkRepository,
            ClinicalHistoryRevisionRepository revisionRepository,
            UserRepository userRepository,
            ClinicalStaffRepository clinicalStaffRepository,
            ObjectMapper objectMapper) {
        this.repository = repository;
        this.patientService = patientService;
        this.userContext = userContext;
        this.episodeRepository = episodeRepository;
        this.medicalNoteRepository = medicalNoteRepository;
        this.documentRepository = documentRepository;
        this.auditEventRepository = auditEventRepository;
        this.clinicalDocumentLinkRepository = clinicalDocumentLinkRepository;
        this.revisionRepository = revisionRepository;
        this.userRepository = userRepository;
        this.clinicalStaffRepository = clinicalStaffRepository;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper().findAndRegisterModules();
    }

    public ClinicalHistoryService(
            ClinicalHistoryRepository repository,
            PatientService patientService,
            AuthenticatedUserContext userContext,
            ClinicalEpisodeRepository episodeRepository,
            MedicalNoteRepository medicalNoteRepository,
            DocumentRepository documentRepository,
            AuditEventRepository auditEventRepository,
            ClinicalDocumentLinkRepository clinicalDocumentLinkRepository) {
        this(repository, patientService, userContext, episodeRepository, medicalNoteRepository,
                documentRepository, auditEventRepository, clinicalDocumentLinkRepository,
                null, null, null, null);
    }

    @Transactional(readOnly = true)
    public Page<ClinicalHistoryResponse> find(UUID patientId, String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        if (patientId != null) {
            patientService.requireByIdAndTenant(patientId, tenantId);
        }
        return repository.findByTenant(tenantId, patientId, CrudTextSupport.likePattern(filter), pageable)
                .map(entity -> toResponse(entity, loadPatient(entity)));
    }

    @Transactional(readOnly = true)
    public ClinicalHistoryResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        ClinicalHistory entity = getForTenant(id);
        return toResponse(entity, loadPatient(entity));
    }

    @Transactional
    public ClinicalHistoryResponse create(ClinicalHistoryRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        if (request.getPatientId() == null) {
            throw new IllegalArgumentException("patientId es obligatorio");
        }
        Patient patient = patientService.requireByIdAndTenant(request.getPatientId(), tenantId);
        String code = nextCode(tenantId);
        OffsetDateTime now = OffsetDateTime.now();

        ClinicalHistory entity = ClinicalHistory.builder()
                .tenantId(tenantId)
                .patientId(patient.getId())
                .code(code)
                .bloodType(normalize(request.getBloodType()))
                .pathologicalAntecedents(normalize(request.getPathologicalAntecedents()))
                .nonPathologicalAntecedents(normalize(request.getNonPathologicalAntecedents()))
                .familyAntecedents(normalize(request.getFamilyAntecedents()))
                .allergies(toAllergies(request.getAllergies()))
                .chronicConditions(normalize(request.getChronicConditions()))
                .currentMedications(toMedications(request.getCurrentMedications()))
                .baseDiagnoses(toDiagnoses(request.getBaseDiagnoses()))
                .observations(normalize(request.getObservations()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity), patient);
    }

    @Transactional
    public ClinicalHistoryResponse update(UUID id, ClinicalHistoryRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        ClinicalHistory entity = getForTenant(id);

        // 1. Snapshot previous state before modifying
        if (revisionRepository != null) {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("bloodType", entity.getBloodType());
            snapshot.put("pathologicalAntecedents", entity.getPathologicalAntecedents());
            snapshot.put("nonPathologicalAntecedents", entity.getNonPathologicalAntecedents());
            snapshot.put("familyAntecedents", entity.getFamilyAntecedents());
            snapshot.put("allergies", entity.getAllergies());
            snapshot.put("chronicConditions", entity.getChronicConditions());
            snapshot.put("currentMedications", entity.getCurrentMedications());
            snapshot.put("baseDiagnoses", entity.getBaseDiagnoses());
            snapshot.put("observations", entity.getObservations());

            String snapshotJson;
            try {
                snapshotJson = objectMapper.writeValueAsString(snapshot);
            } catch (JsonProcessingException e) {
                snapshotJson = "{}";
            }

            // Calculate diff
            List<String> changedFields = new ArrayList<>();
            if (request.getBloodType() != null && !Objects.equals(normalize(request.getBloodType()), entity.getBloodType())) {
                changedFields.add("bloodType");
            }
            if (request.getPathologicalAntecedents() != null && !Objects.equals(normalize(request.getPathologicalAntecedents()), entity.getPathologicalAntecedents())) {
                changedFields.add("pathologicalAntecedents");
            }
            if (request.getNonPathologicalAntecedents() != null && !Objects.equals(normalize(request.getNonPathologicalAntecedents()), entity.getNonPathologicalAntecedents())) {
                changedFields.add("nonPathologicalAntecedents");
            }
            if (request.getFamilyAntecedents() != null && !Objects.equals(normalize(request.getFamilyAntecedents()), entity.getFamilyAntecedents())) {
                changedFields.add("familyAntecedents");
            }
            if (request.getAllergies() != null && !Objects.equals(toAllergies(request.getAllergies()), entity.getAllergies())) {
                changedFields.add("allergies");
            }
            if (request.getChronicConditions() != null && !Objects.equals(normalize(request.getChronicConditions()), entity.getChronicConditions())) {
                changedFields.add("chronicConditions");
            }
            if (request.getCurrentMedications() != null && !Objects.equals(toMedications(request.getCurrentMedications()), entity.getCurrentMedications())) {
                changedFields.add("currentMedications");
            }
            if (request.getBaseDiagnoses() != null && !Objects.equals(toDiagnoses(request.getBaseDiagnoses()), entity.getBaseDiagnoses())) {
                changedFields.add("baseDiagnoses");
            }
            if (request.getObservations() != null && !Objects.equals(normalize(request.getObservations()), entity.getObservations())) {
                changedFields.add("observations");
            }

            String changeSummary = changedFields.isEmpty()
                    ? "Actualización general sin cambios estructurales"
                    : "Campos modificados: " + String.join(", ", changedFields);

            UUID authorId = null;
            try {
                authorId = userContext.requireUserId();
            } catch (Exception ignored) {
            }

            long currentRevisions = revisionRepository.countByTenantIdAndClinicalHistoryId(tenantId, id);
            ClinicalHistoryRevision revision = ClinicalHistoryRevision.builder()
                    .tenantId(tenantId)
                    .clinicalHistoryId(id)
                    .revisionNumber((int) currentRevisions + 1)
                    .authorId(authorId)
                    .createdAt(OffsetDateTime.now())
                    .changeSummary(changeSummary)
                    .snapshotData(snapshotJson)
                    .build();
            revisionRepository.save(revision);
        }

        if (request.getPatientId() != null && !request.getPatientId().equals(entity.getPatientId())) {
            Patient patient = patientService.requireByIdAndTenant(request.getPatientId(), tenantId);
            entity.setPatientId(patient.getId());
        }

        if (request.getBloodType() != null) {
            entity.setBloodType(normalize(request.getBloodType()));
        }
        if (request.getPathologicalAntecedents() != null) {
            entity.setPathologicalAntecedents(normalize(request.getPathologicalAntecedents()));
        }
        if (request.getNonPathologicalAntecedents() != null) {
            entity.setNonPathologicalAntecedents(normalize(request.getNonPathologicalAntecedents()));
        }
        if (request.getFamilyAntecedents() != null) {
            entity.setFamilyAntecedents(normalize(request.getFamilyAntecedents()));
        }
        if (request.getAllergies() != null) {
            entity.setAllergies(toAllergies(request.getAllergies()));
        }
        if (request.getChronicConditions() != null) {
            entity.setChronicConditions(normalize(request.getChronicConditions()));
        }
        if (request.getCurrentMedications() != null) {
            entity.setCurrentMedications(toMedications(request.getCurrentMedications()));
        }
        if (request.getBaseDiagnoses() != null) {
            entity.setBaseDiagnoses(toDiagnoses(request.getBaseDiagnoses()));
        }
        if (request.getObservations() != null) {
            entity.setObservations(normalize(request.getObservations()));
        }
        entity.setUpdatedAt(OffsetDateTime.now());
        return toResponse(repository.save(entity), loadPatient(entity));
    }

    @Transactional(readOnly = true)
    public List<ClinicalHistoryRevisionResponse> getRevisions(UUID historyId) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        getForTenant(historyId);

        if (revisionRepository == null) {
            return List.of();
        }

        List<ClinicalHistoryRevision> revisions = revisionRepository
                .findByTenantIdAndClinicalHistoryIdOrderByRevisionNumberDesc(tenantId, historyId);

        return revisions.stream().map(rev -> {
            String authorName = null;
            if (rev.getAuthorId() != null && userRepository != null) {
                authorName = userRepository.findByIdAndDeletedAtIsNull(rev.getAuthorId())
                        .map(u -> u.getFirstName() + " " + u.getLastName())
                        .orElse(null);
            }
            return ClinicalHistoryRevisionResponse.builder()
                    .id(rev.getId())
                    .clinicalHistoryId(rev.getClinicalHistoryId())
                    .revisionNumber(rev.getRevisionNumber())
                    .authorId(rev.getAuthorId())
                    .authorName(authorName)
                    .createdAt(rev.getCreatedAt())
                    .changeSummary(rev.getChangeSummary())
                    .snapshotData(rev.getSnapshotData())
                    .build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<TimelineEventResponse> timeline(UUID id) {
        return timeline(id, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<TimelineEventResponse> timeline(UUID id, OffsetDateTime dateFrom, OffsetDateTime dateTo,
                                                String eventType, UUID professionalId, String specialty,
                                                UUID episodeId) {
        userContext.establishDatabaseContext();
        ClinicalHistory history = getForTenant(id);
        UUID tenantId = userContext.requireTenantId();
        List<TimelineEventResponse> events = new ArrayList<>();

        events.add(TimelineEventResponse.builder()
                .occurredAt(history.getCreatedAt())
                .eventType("CLINICAL_HISTORY_OPENED")
                .code(history.getCode())
                .status("OPEN")
                .referenceId(history.getId())
                .description("Apertura del expediente clínico")
                .build());

        for (ClinicalEpisode episode : episodeRepository.findByTenantIdAndClinicalHistoryIdOrderByStartedAtDesc(tenantId, id)) {
            events.add(TimelineEventResponse.builder()
                    .occurredAt(episode.getStartedAt())
                    .eventType("EPISODE")
                    .code(episode.getCode())
                    .status(episode.getStatus())
                    .referenceId(episode.getId())
                    .episodeId(episode.getId())
                    .description(episode.getEpisodeType())
                    .build());
        }

        medicalNoteRepository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(tenantId, id)
                .forEach(note -> {
                    String spec = null;
                    if (clinicalStaffRepository != null && note.getAuthorId() != null) {
                        spec = clinicalStaffRepository.findByUserIdAndTenantId(note.getAuthorId(), tenantId)
                                .map(ClinicalStaff::getSpecialty).orElse(null);
                    }
                    events.add(TimelineEventResponse.builder()
                            .occurredAt(note.getCreatedAt())
                            .eventType("MEDICAL_NOTE")
                            .code(note.getNoteType())
                            .status("RECORDED")
                            .referenceId(note.getId())
                            .episodeId(note.getEpisodeId())
                            .professionalId(note.getAuthorId())
                            .specialty(spec)
                            .description(summary(note.getContent()))
                            .build());
                });

        documentRepository.findLinkedToClinicalHistory(tenantId, id)
                .forEach(document -> {
                    String spec = null;
                    if (clinicalStaffRepository != null && document.getAuthorId() != null) {
                        spec = clinicalStaffRepository.findByUserIdAndTenantId(document.getAuthorId(), tenantId)
                                .map(ClinicalStaff::getSpecialty).orElse(null);
                    }
                    events.add(TimelineEventResponse.builder()
                            .occurredAt(document.getCreatedAt())
                            .eventType("DOCUMENT")
                            .code(document.getCode())
                            .status(document.getStatus().name())
                            .referenceId(document.getId())
                            .professionalId(document.getAuthorId())
                            .specialty(spec)
                            .description(document.getName())
                            .build());
                });

        return events.stream()
                .filter(e -> dateFrom == null || (e.getOccurredAt() != null && !e.getOccurredAt().isBefore(dateFrom)))
                .filter(e -> dateTo == null || (e.getOccurredAt() != null && !e.getOccurredAt().isAfter(dateTo)))
                .filter(e -> eventType == null || eventType.isBlank() || (e.getEventType() != null && e.getEventType().equalsIgnoreCase(eventType.trim())))
                .filter(e -> episodeId == null || (e.getEpisodeId() != null && episodeId.equals(e.getEpisodeId())) || episodeId.equals(e.getReferenceId()))
                .filter(e -> professionalId == null || professionalId.equals(e.getProfessionalId()))
                .filter(e -> specialty == null || specialty.isBlank() || (e.getSpecialty() != null && e.getSpecialty().equalsIgnoreCase(specialty.trim())))
                .sorted(Comparator.comparing(TimelineEventResponse::getOccurredAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(TimelineEventResponse::getEventType, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    @Transactional
    public void delete(UUID id, DeleteClinicalHistoryRequest request) {
        UUID tenantId = userContext.requireTenantId();
        UUID userId = userContext.requireUserId();
        userContext.establishDatabaseContext();

        if (request == null || request.reason() == null || request.reason().trim().length() < 10) {
            throw new IllegalArgumentException("El motivo de baja clínica debe tener al menos 10 caracteres");
        }

        ClinicalHistory entity = repository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Historia clínica no encontrada"));

        OffsetDateTime now = OffsetDateTime.now();
        entity.setDeletedAt(now);
        entity.setDeletionReason(request.reason().trim());
        entity.setDeletedBy(userId);
        repository.save(entity);

        AuditEvent auditEvent = AuditEvent.builder()
                .tenantId(tenantId)
                .userId(userId)
                .action("CLINICAL_HISTORY_DELETED")
                .entityType("clinical_history")
                .entityId(entity.getId())
                .occurredAt(now)
                .result("SUCCESS")
                .details("{\"reason\":\"" + request.reason().trim().replace("\"", "\\\"") + "\"}")
                .build();
        auditEventRepository.save(auditEvent);
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> getLinkedDocuments(UUID historyId) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        getForTenant(historyId);
        return documentRepository.findLinkedToClinicalHistory(tenantId, historyId).stream()
                .map(this::toDocumentResponse)
                .toList();
    }

    @Transactional
    public DocumentResponse linkDocument(UUID historyId, UUID documentId) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        ClinicalHistory history = getForTenant(historyId);
        Document document = documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId)
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));

        if (!clinicalDocumentLinkRepository.existsByTenantIdAndClinicalHistoryIdAndIdDocumentId(tenantId, historyId, documentId)) {
            ClinicalDocumentLink link = ClinicalDocumentLink.builder()
                    .id(new ClinicalDocumentLinkId(documentId, history.getPatientId()))
                    .tenantId(tenantId)
                    .clinicalHistoryId(history.getId())
                    .linkedAt(OffsetDateTime.now())
                    .build();
            clinicalDocumentLinkRepository.save(link);
        }
        return toDocumentResponse(document);
    }

    @Transactional
    public void unlinkDocument(UUID historyId, UUID documentId) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        getForTenant(historyId);
        clinicalDocumentLinkRepository.deleteByTenantIdAndClinicalHistoryIdAndIdDocumentId(tenantId, historyId, documentId);
    }

    private DocumentResponse toDocumentResponse(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getDocumentTypeId(),
                document.getExpedientId(),
                document.getAuthorId(),
                document.getResponsibleId(),
                document.getDepartmentId(),
                document.getPatientId(),
                document.getSpecialty(),
                document.getInstitutionalProcess(),
                document.getMetadata(),
                document.getCode(),
                document.getName(),
                document.getDescription(),
                document.getStatus(),
                document.getCurrentVersion(),
                document.getIssueDate(),
                document.getExpiryDate(),
                document.getIsExternalSource(),
                document.getSource(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private ClinicalHistory getForTenant(UUID id) {
        return repository.findByIdAndTenantIdAndDeletedAtIsNull(id, userContext.requireTenantId())
                .orElseThrow(() -> new NotFoundException("Historia clínica no encontrada"));
    }

    private Patient loadPatient(ClinicalHistory entity) {
        return patientService.requireByIdAndTenant(entity.getPatientId(), entity.getTenantId());
    }

    private String nextCode(UUID tenantId) {
        String candidate = CODE_PREFIX + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        while (repository.existsByTenantIdAndCode(tenantId, candidate)) {
            candidate = CODE_PREFIX + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
        return candidate;
    }

    private List<AllergyEntry> toAllergies(List<ClinicalHistoryRequest.AllergyRequest> allergies) {
        if (allergies == null) {
            return List.of();
        }
        return allergies.stream()
                .filter(entry -> entry != null && entry.allergen() != null && !entry.allergen().isBlank())
                .map(entry -> new AllergyEntry(
                        entry.allergen().trim(),
                        normalize(entry.severity()),
                        normalize(entry.reaction())))
                .toList();
    }

    private List<MedicationEntry> toMedications(List<ClinicalHistoryRequest.MedicationRequest> medications) {
        if (medications == null) {
            return List.of();
        }
        return medications.stream()
                .filter(entry -> entry != null && entry.name() != null && !entry.name().isBlank())
                .map(entry -> new MedicationEntry(
                        entry.name().trim(),
                        normalize(entry.dose()),
                        normalize(entry.frequency())))
                .toList();
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String summary(String value) {
        if (value == null || value.isBlank()) return "Nota clínica sin contenido visible";
        String normalized = value.trim();
        return normalized.length() <= 240 ? normalized : normalized.substring(0, 237) + "...";
    }

    private List<BaseDiagnosisEntry> toDiagnoses(List<ClinicalHistoryRequest.DiagnosisRequest> diagnoses) {
        if (diagnoses == null) return List.of();
        return diagnoses.stream().filter(d -> d != null && d.description() != null
                && !d.description().isBlank())
                .map(d -> new BaseDiagnosisEntry(normalize(d.code()),
                        d.description().trim(), normalize(d.diagnosedAt()))).toList();
    }

    private ClinicalHistoryResponse toResponse(ClinicalHistory entity, Patient patient) {
        return ClinicalHistoryResponse.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .patientId(entity.getPatientId())
                .patientLabel(patient.getFirstName() + " " + patient.getLastName())
                .bloodType(entity.getBloodType())
                .pathologicalAntecedents(entity.getPathologicalAntecedents())
                .nonPathologicalAntecedents(entity.getNonPathologicalAntecedents())
                .familyAntecedents(entity.getFamilyAntecedents())
                .allergies(entity.getAllergies())
                .chronicConditions(entity.getChronicConditions())
                .currentMedications(entity.getCurrentMedications())
                .baseDiagnoses(entity.getBaseDiagnoses())
                .observations(entity.getObservations())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .version(entity.getVersion())
                .build();
    }
}
