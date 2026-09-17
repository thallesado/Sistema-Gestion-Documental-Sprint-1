package com.lta.gestdocum.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class ClinicalHistoryRequest {

    private UUID patientId;

    @Size(max = 10)
    private String bloodType;

    @Size(max = 4000)
    private String pathologicalAntecedents;

    @Size(max = 4000)
    private String nonPathologicalAntecedents;

    @Size(max = 4000)
    private String familyAntecedents;

    @Valid
    private List<AllergyRequest> allergies;

    @Size(max = 2000)
    private String chronicConditions;

    @Valid
    private List<MedicationRequest> currentMedications;

    @Size(max = 4000)
    private String observations;

    public record AllergyRequest(
            @NotBlank String allergen,
            @Size(max = 20) String severity,
            @Size(max = 255) String reaction) {
    }

    public record MedicationRequest(
            @NotBlank String name,
            @Size(max = 120) String dose,
            @Size(max = 120) String frequency) {
    }
}