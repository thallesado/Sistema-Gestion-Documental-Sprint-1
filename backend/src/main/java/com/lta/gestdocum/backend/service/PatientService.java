package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PatientResponse;
import com.lta.gestdocum.backend.dto.PatientCreateRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.PatientRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.time.OffsetDateTime;

@Service
public class PatientService {

    private final PatientRepository repository;
    private final ClinicalHistoryRepository clinicalHistoryRepository;
    private final AuthenticatedUserContext userContext;

    public PatientService(PatientRepository repository,
                          ClinicalHistoryRepository clinicalHistoryRepository,
                          AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.clinicalHistoryRepository = clinicalHistoryRepository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<PatientResponse> find(String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return repository.findByTenant(tenantId, CrudTextSupport.likePattern(filter), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public PatientResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        return toResponse(getForTenant(id));
    }

    @Transactional
    public PatientResponse create(PatientCreateRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String type = request.getDocumentType().trim().toUpperCase();
        String number = request.getDocumentNumber().trim().toUpperCase();
        if (!type.equals("CI") && !type.equals("SEGURO")) {
            throw new IllegalArgumentException("documentType debe ser CI o SEGURO");
        }
        if (repository.existsByTenantIdAndDocumentTypeIgnoreCaseAndDocumentNumberIgnoreCaseAndDeletedAtIsNull(
                tenantId, type, number)) {
            throw new DuplicateResourceException("Ya existe un expediente para ese identificador en el tenant");
        }
        OffsetDateTime now = OffsetDateTime.now();
        Patient patient = Patient.builder().tenantId(tenantId).documentType(type)
                .documentNumber(number).firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim()).birthDate(request.getBirthDate())
                .gender(normalize(request.getGender())).phone(normalize(request.getPhone()))
                .email(normalize(request.getEmail())).address(normalize(request.getAddress()))
                .createdAt(now).updatedAt(now).build();
        patient = repository.saveAndFlush(patient);
        clinicalHistoryRepository.save(ClinicalHistory.builder()
                .tenantId(tenantId)
                .patientId(patient.getId())
                .code(nextHistoryCode(tenantId))
                .createdAt(now)
                .updatedAt(now)
                .build());
        return toResponse(patient);
    }

    public Patient requireByIdAndTenant(UUID id, UUID tenantId) {
        return repository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Paciente no encontrado en el tenant"));
    }

    private Patient getForTenant(UUID id) {
        return repository.findByIdAndTenantIdAndDeletedAtIsNull(id, userContext.requireTenantId())
                .orElseThrow(() -> new NotFoundException("Paciente no encontrado"));
    }

    private PatientResponse toResponse(Patient patient) {
        return PatientResponse.builder()
                .id(patient.getId())
                .documentType(patient.getDocumentType())
                .documentNumber(patient.getDocumentNumber())
                .firstName(patient.getFirstName())
                .lastName(patient.getLastName())
                .birthDate(patient.getBirthDate())
                .gender(patient.getGender())
                .phone(patient.getPhone())
                .email(patient.getEmail())
                .status(patient.getStatus())
                .build();
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String nextHistoryCode(UUID tenantId) {
        String candidate;
        do {
            candidate = "HC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (clinicalHistoryRepository.existsByTenantIdAndCode(tenantId, candidate));
        return candidate;
    }
}
