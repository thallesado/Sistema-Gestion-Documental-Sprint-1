package com.lta.gestdocum.clinico.application.service;

import com.lta.gestdocum.clinico.application.dto.ClinicalHistoryRequest.AllergyRequest;
import com.lta.gestdocum.clinico.application.dto.ClinicalHistoryRequest.DiagnosisRequest;
import com.lta.gestdocum.clinico.application.dto.ClinicalHistoryRequest.MedicationRequest;
import com.lta.gestdocum.clinico.application.dto.ClinicalHistoryResponse;
import com.lta.gestdocum.clinico.domain.model.*;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class ClinicalHistoryMapper {

    public List<AllergyEntry> toAllergies(List<AllergyRequest> dtos) {
        if (dtos == null) return Collections.emptyList();
        return dtos.stream()
                .filter(dto -> dto != null && dto.allergen() != null && !dto.allergen().isBlank())
                .map(dto -> AllergyEntry.builder()
                        .allergen(dto.allergen().trim())
                        .reaction(dto.reaction() != null ? dto.reaction().trim() : null)
                        .severity(dto.severity() != null ? dto.severity().trim() : null)
                        .build())
                .toList();
    }

    public List<MedicationEntry> toMedications(List<MedicationRequest> dtos) {
        if (dtos == null) return Collections.emptyList();
        return dtos.stream()
                .filter(dto -> dto != null && dto.name() != null && !dto.name().isBlank())
                .map(dto -> MedicationEntry.builder()
                        .name(dto.name().trim())
                        .dose(dto.dose() != null ? dto.dose().trim() : null)
                        .frequency(dto.frequency() != null ? dto.frequency().trim() : null)
                        .build())
                .toList();
    }

    public List<BaseDiagnosisEntry> toDiagnoses(List<DiagnosisRequest> dtos) {
        if (dtos == null) return Collections.emptyList();
        return dtos.stream()
                .filter(dto -> dto != null && dto.description() != null && !dto.description().isBlank())
                .map(dto -> BaseDiagnosisEntry.builder()
                        .code(dto.code() != null ? dto.code().trim() : null)
                        .description(dto.description().trim())
                        .diagnosedAt(dto.diagnosedAt() != null ? dto.diagnosedAt().trim() : null)
                        .build())
                .toList();
    }

    public ClinicalHistoryResponse toResponse(ClinicalHistory entity, Patient patient) {
        String patientLabel = patient != null ? patient.getFirstName() + " " + patient.getLastName() : null;

        return ClinicalHistoryResponse.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .patientId(entity.getPatientId())
                .patientLabel(patientLabel)
                .bloodType(entity.getBloodType())
                .pathologicalAntecedents(entity.getPathologicalAntecedents())
                .nonPathologicalAntecedents(entity.getNonPathologicalAntecedents())
                .familyAntecedents(entity.getFamilyAntecedents())
                .allergies(entity.getAllergies() != null ? entity.getAllergies() : List.of())
                .chronicConditions(entity.getChronicConditions())
                .currentMedications(entity.getCurrentMedications() != null ? entity.getCurrentMedications() : List.of())
                .baseDiagnoses(entity.getBaseDiagnoses() != null ? entity.getBaseDiagnoses() : List.of())
                .observations(entity.getObservations())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
