package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: ClinicalHistory
 * Mapea la tabla relacional: clinical_histories
 */
public class ClinicalHistory {

    private UUID id;
    private UUID tenantId;
    private UUID patientId;
    private String code;
    private String bloodType;
    private String pathologicalAntecedents;
    private String nonPathologicalAntecedents;
    private String familyAntecedents;
    private String allergies;
    private String chronicConditions;
    private String currentMedications;
    private String baseDiagnoses;
    private String observations;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Patient patient;

    public ClinicalHistory() {
    }

    public UUID getId() {
        return this.id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTenantId() {
        return this.tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getPatientId() {
        return this.patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public String getCode() {
        return this.code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getBloodType() {
        return this.bloodType;
    }

    public void setBloodType(String bloodType) {
        this.bloodType = bloodType;
    }

    public String getPathologicalAntecedents() {
        return this.pathologicalAntecedents;
    }

    public void setPathologicalAntecedents(String pathologicalAntecedents) {
        this.pathologicalAntecedents = pathologicalAntecedents;
    }

    public String getNonPathologicalAntecedents() {
        return this.nonPathologicalAntecedents;
    }

    public void setNonPathologicalAntecedents(String nonPathologicalAntecedents) {
        this.nonPathologicalAntecedents = nonPathologicalAntecedents;
    }

    public String getFamilyAntecedents() {
        return this.familyAntecedents;
    }

    public void setFamilyAntecedents(String familyAntecedents) {
        this.familyAntecedents = familyAntecedents;
    }

    public String getAllergies() {
        return this.allergies;
    }

    public void setAllergies(String allergies) {
        this.allergies = allergies;
    }

    public String getChronicConditions() {
        return this.chronicConditions;
    }

    public void setChronicConditions(String chronicConditions) {
        this.chronicConditions = chronicConditions;
    }

    public String getCurrentMedications() {
        return this.currentMedications;
    }

    public void setCurrentMedications(String currentMedications) {
        this.currentMedications = currentMedications;
    }

    public String getBaseDiagnoses() {
        return this.baseDiagnoses;
    }

    public void setBaseDiagnoses(String baseDiagnoses) {
        this.baseDiagnoses = baseDiagnoses;
    }

    public String getObservations() {
        return this.observations;
    }

    public void setObservations(String observations) {
        this.observations = observations;
    }

    public Date getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return this.updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Patient getPatient() {
        return this.patient;
    }

    public void setPatient(Patient patient) {
        this.patient = patient;
    }

}
