package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ClinicalHistoryRequest;
import com.lta.gestdocum.backend.dto.ClinicalHistoryResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.AllergyEntry;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.MedicationEntry;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ClinicalHistoryService {

    private static final String CODE_PREFIX = "HC-";

    private final ClinicalHistoryRepository repository;
    private final PatientService patientService;
    private final AuthenticatedUserContext userContext;

    public ClinicalHistoryService(
            ClinicalHistoryRepository repository,
            PatientService patientService,
            AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.patientService = patientService;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<ClinicalHistoryResponse> find(UUID patientId, String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        if (patientId != null) {
            patientService.requireByIdAndTenant(patientId, tenantId);
        }
        return repository.findByTenant(tenantId, patientId, CrudTextSupport.likePattern(filter), pageable)
                .map(entity -> toResponse(entity, loadPatient(entity)));
    }

    @Transactional(readOnly = true)
    public ClinicalHistoryResponse findById(UUID id) {
        ClinicalHistory entity = getForTenant(id);
        return toResponse(entity, loadPatient(entity));
    }

    @Transactional
    public ClinicalHistoryResponse create(ClinicalHistoryRequest request) {
        UUID tenantId = userContext.requireTenantId();
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
                .observations(normalize(request.getObservations()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity), patient);
    }

    @Transactional
    public ClinicalHistoryResponse update(UUID id, ClinicalHistoryRequest request) {
        UUID tenantId = userContext.requireTenantId();
        ClinicalHistory entity = getForTenant(id);
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
        if (request.getObservations() != null) {
            entity.setObservations(normalize(request.getObservations()));
        }
        entity.setUpdatedAt(OffsetDateTime.now());
        return toResponse(repository.save(entity), loadPatient(entity));
    }

    private ClinicalHistory getForTenant(UUID id) {
        return repository.findByIdAndTenantId(id, userContext.requireTenantId())
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
                .observations(entity.getObservations())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}