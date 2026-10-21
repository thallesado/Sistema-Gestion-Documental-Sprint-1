package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: DicomStudy
 * Mapea la tabla relacional: dicom_studies
 */
public class DicomStudy {

    private UUID id;
    private UUID tenantId;
    private UUID patientId;
    private UUID uploaderId;
    private String studyInstanceUid;
    private Date studyDate;
    private String studyDescription;
    private String accessionNumber;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Patient patient;
    private User uploader;

    public DicomStudy() {
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

    public UUID getUploaderId() {
        return this.uploaderId;
    }

    public void setUploaderId(UUID uploaderId) {
        this.uploaderId = uploaderId;
    }

    public String getStudyInstanceUid() {
        return this.studyInstanceUid;
    }

    public void setStudyInstanceUid(String studyInstanceUid) {
        this.studyInstanceUid = studyInstanceUid;
    }

    public Date getStudyDate() {
        return this.studyDate;
    }

    public void setStudyDate(Date studyDate) {
        this.studyDate = studyDate;
    }

    public String getStudyDescription() {
        return this.studyDescription;
    }

    public void setStudyDescription(String studyDescription) {
        this.studyDescription = studyDescription;
    }

    public String getAccessionNumber() {
        return this.accessionNumber;
    }

    public void setAccessionNumber(String accessionNumber) {
        this.accessionNumber = accessionNumber;
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

    public User getUploader() {
        return this.uploader;
    }

    public void setUploader(User uploader) {
        this.uploader = uploader;
    }

}
