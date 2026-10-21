package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: ClinicalDocumentLink
 * Mapea la tabla relacional: clinical_document_links
 */
public class ClinicalDocumentLink {

    private UUID tenantId;
    private UUID documentId;
    private UUID patientId;
    private UUID clinicalHistoryId;
    private UUID episodeId;
    private Date linkedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Document document;
    private Patient patient;
    private ClinicalHistory clinicalHistory;
    private ClinicalEpisode episode;

    public ClinicalDocumentLink() {
    }

    public UUID getTenantId() {
        return this.tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getDocumentId() {
        return this.documentId;
    }

    public void setDocumentId(UUID documentId) {
        this.documentId = documentId;
    }

    public UUID getPatientId() {
        return this.patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public UUID getClinicalHistoryId() {
        return this.clinicalHistoryId;
    }

    public void setClinicalHistoryId(UUID clinicalHistoryId) {
        this.clinicalHistoryId = clinicalHistoryId;
    }

    public UUID getEpisodeId() {
        return this.episodeId;
    }

    public void setEpisodeId(UUID episodeId) {
        this.episodeId = episodeId;
    }

    public Date getLinkedAt() {
        return this.linkedAt;
    }

    public void setLinkedAt(Date linkedAt) {
        this.linkedAt = linkedAt;
    }

    public Document getDocument() {
        return this.document;
    }

    public void setDocument(Document document) {
        this.document = document;
    }

    public Patient getPatient() {
        return this.patient;
    }

    public void setPatient(Patient patient) {
        this.patient = patient;
    }

    public ClinicalHistory getClinicalHistory() {
        return this.clinicalHistory;
    }

    public void setClinicalHistory(ClinicalHistory clinicalHistory) {
        this.clinicalHistory = clinicalHistory;
    }

    public ClinicalEpisode getEpisode() {
        return this.episode;
    }

    public void setEpisode(ClinicalEpisode episode) {
        this.episode = episode;
    }

}
