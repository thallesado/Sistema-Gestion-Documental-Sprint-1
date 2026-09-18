package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.AllergyEntry;
import com.lta.gestdocum.backend.model.MedicationEntry;
import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import com.lta.gestdocum.backend.model.BaseDiagnosisEntry;

@Value
@Builder
public class ClinicalHistoryResponse {
    UUID id;
    String code;
    UUID patientId;
    String patientLabel;
    String bloodType;
    String pathologicalAntecedents;
    String nonPathologicalAntecedents;
    String familyAntecedents;
    List<AllergyEntry> allergies;
    String chronicConditions;
    List<MedicationEntry> currentMedications;
    List<BaseDiagnosisEntry> baseDiagnoses;
    String observations;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}