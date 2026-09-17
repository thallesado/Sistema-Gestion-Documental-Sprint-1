package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "clinical_histories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicalHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(nullable = false, length = 60)
    private String code;

    @Column(name = "blood_type", length = 10)
    private String bloodType;

    @Column(name = "pathological_antecedents", columnDefinition = "text")
    private String pathologicalAntecedents;

    @Column(name = "non_pathological_antecedents", columnDefinition = "text")
    private String nonPathologicalAntecedents;

    @Column(name = "family_antecedents", columnDefinition = "text")
    private String familyAntecedents;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "allergies", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<AllergyEntry> allergies = new ArrayList<>();

    @Column(name = "chronic_conditions", columnDefinition = "text")
    private String chronicConditions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "current_medications", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<MedicationEntry> currentMedications = new ArrayList<>();

    @Column(columnDefinition = "text")
    private String observations;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}