package com.lta.gestdocum.clinico.application.service;

import com.lta.gestdocum.clinico.application.dto.ClinicalHistoryRequest;
import com.lta.gestdocum.clinico.application.dto.ClinicalHistoryResponse;
import com.lta.gestdocum.clinico.application.dto.TimelineEventResponse;
import com.lta.gestdocum.clinico.domain.model.ClinicalEpisode;
import com.lta.gestdocum.clinico.domain.model.ClinicalHistory;
import com.lta.gestdocum.clinico.domain.model.Patient;
import com.lta.gestdocum.clinico.domain.repository.ClinicalEpisodeRepository;
import com.lta.gestdocum.clinico.domain.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.clinico.domain.repository.MedicalNoteRepository;
import com.lta.gestdocum.documentos.domain.repository.DocumentRepository;
import com.lta.gestdocum.shared.exception.NotFoundException;
import com.lta.gestdocum.shared.security.AuthenticatedUserContext;
import com.lta.gestdocum.shared.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class ClinicalHistoryService {

    private static final String CODE_PREFIX = "HC-";

    private final ClinicalHistoryRepository repository;
    private final PatientService patientService;
    private final AuthenticatedUserContext userContext;
    private final ClinicalEpisodeRepository episodeRepository;
    private final MedicalNoteRepository medicalNoteRepository;
    private final DocumentRepository documentRepository;
    private final ClinicalHistoryMapper mapper;

    public ClinicalHistoryService(
            ClinicalHistoryRepository repository,
            PatientService patientService,
            AuthenticatedUserContext userContext,
            ClinicalEpisodeRepository episodeRepository,
            MedicalNoteRepository medicalNoteRepository,
            DocumentRepository documentRepository,
            ClinicalHistoryMapper mapper) {
        this.repository = repository;
        this.patientService = patientService;
        this.userContext = userContext;
        this.episodeRepository = episodeRepository;
        this.medicalNoteRepository = medicalNoteRepository;
        this.documentRepository = documentRepository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Page<ClinicalHistoryResponse> find(UUID patientId, String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        if (patientId != null) {
            patientService.requireByIdAndTenant(patientId, tenantId);
        }
        return repository.findByTenant(tenantId, patientId, CrudTextSupport.likePattern(filter), pageable)
                .map(entity -> mapper.toResponse(entity, loadPatient(entity)));
    }

    @Transactional(readOnly = true)
    public ClinicalHistoryResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        ClinicalHistory entity = getForTenant(id);
        return mapper.toResponse(entity, loadPatient(entity));
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
                .allergies(mapper.toAllergies(request.getAllergies()))
                .chronicConditions(normalize(request.getChronicConditions()))
                .currentMedications(mapper.toMedications(request.getCurrentMedications()))
                .baseDiagnoses(mapper.toDiagnoses(request.getBaseDiagnoses()))
                .observations(normalize(request.getObservations()))
                .createdAt(now)
                .updatedAt(now)
                .build();

        return mapper.toResponse(repository.save(entity), patient);
    }

    @Transactional
    public ClinicalHistoryResponse update(UUID id, ClinicalHistoryRequest request) {
        userContext.establishDatabaseContext();
        ClinicalHistory entity = getForTenant(id);
        OffsetDateTime now = OffsetDateTime.now();

        entity.setBloodType(normalize(request.getBloodType()));
        entity.setPathologicalAntecedents(normalize(request.getPathologicalAntecedents()));
        entity.setNonPathologicalAntecedents(normalize(request.getNonPathologicalAntecedents()));
        entity.setFamilyAntecedents(normalize(request.getFamilyAntecedents()));
        entity.setAllergies(mapper.toAllergies(request.getAllergies()));
        entity.setChronicConditions(normalize(request.getChronicConditions()));
        entity.setCurrentMedications(mapper.toMedications(request.getCurrentMedications()));
        entity.setBaseDiagnoses(mapper.toDiagnoses(request.getBaseDiagnoses()));
        entity.setObservations(normalize(request.getObservations()));
        entity.setUpdatedAt(now);

        return mapper.toResponse(repository.save(entity), loadPatient(entity));
    }

    @Transactional(readOnly = true)
    public List<TimelineEventResponse> getTimeline(UUID historyId) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        ClinicalHistory history = getForTenant(historyId);
        List<TimelineEventResponse> timeline = new ArrayList<>();

        List<ClinicalEpisode> episodes = episodeRepository.findByTenantIdAndClinicalHistoryId(tenantId, history.getId());
        for (ClinicalEpisode ep : episodes) {
            timeline.add(TimelineEventResponse.builder()
                    .id(ep.getId())
                    .eventType("EPISODIO")
                    .title("Episodio: " + ep.getCode())
                    .description(ep.getReasonForConsultation())
                    .eventDate(ep.getStartDate() != null ? ep.getStartDate().atStartOfDay().atOffset(OffsetDateTime.now().getOffset()) : ep.getCreatedAt())
                    .status(ep.getStatus() != null ? ep.getStatus().name() : null)
                    .build());

            medicalNoteRepository.findByTenantIdAndEpisodeId(tenantId, ep.getId()).forEach(note -> {
                timeline.add(TimelineEventResponse.builder()
                        .id(note.getId())
                        .eventType("NOTA_MEDICA")
                        .title("Nota: " + (note.getNoteType() != null ? note.getNoteType().name() : "Evolución"))
                        .description(note.getSubjective() != null ? note.getSubjective() : note.getPlan())
                        .eventDate(note.getCreatedAt())
                        .status("REGISTRADO")
                        .build());
            });
        }

        if (history.getPatientId() != null) {
            documentRepository.findByTenantIdAndAuthorId(tenantId, history.getPatientId()).forEach(doc -> {
                timeline.add(TimelineEventResponse.builder()
                        .id(doc.getId())
                        .eventType("DOCUMENTO")
                        .title("Documento: " + doc.getName())
                        .description("Código: " + doc.getCode())
                        .eventDate(doc.getCreatedAt())
                        .status(doc.getStatus() != null ? doc.getStatus().name() : null)
                        .build());
            });
        }

        timeline.sort(Comparator.comparing(TimelineEventResponse::getEventDate, Comparator.nullsLast(Comparator.reverseOrder())));
        return timeline;
    }

    private ClinicalHistory getForTenant(UUID id) {
        UUID tenantId = userContext.requireTenantId();
        return repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Historia clínica no encontrada"));
    }

    private Patient loadPatient(ClinicalHistory entity) {
        if (entity.getPatientId() == null) return null;
        try {
            return patientService.requireByIdAndTenant(entity.getPatientId(), entity.getTenantId());
        } catch (Exception e) {
            return null;
        }
    }

    private String nextCode(UUID tenantId) {
        long count = repository.countByTenantId(tenantId);
        return String.format("%s%05d", CODE_PREFIX, count + 1);
    }

    private String normalize(String value) {
        return CrudTextSupport.normalize(value);
    }
}
