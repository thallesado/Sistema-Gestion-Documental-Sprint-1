package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PatientResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.repository.PatientRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class PatientService {

    private final PatientRepository repository;
    private final AuthenticatedUserContext userContext;

    public PatientService(PatientRepository repository, AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<PatientResponse> find(String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        return repository.findByTenant(tenantId, CrudTextSupport.likePattern(filter), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public PatientResponse findById(UUID id) {
        return toResponse(getForTenant(id));
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
}