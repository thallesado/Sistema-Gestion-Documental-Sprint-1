package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: MedicalNote
 * Mapea la tabla relacional: medical_notes
 */
public class MedicalNote {

    private UUID id;
    private UUID tenantId;
    private UUID clinicalHistoryId;
    private UUID episodeId;
    private UUID authorId;
    private String noteType;
    private String content;
    private Date createdAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private ClinicalHistory clinicalHistory;
    private ClinicalEpisode episode;
    private User author;

    public MedicalNote() {
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

    public UUID getAuthorId() {
        return this.authorId;
    }

    public void setAuthorId(UUID authorId) {
        this.authorId = authorId;
    }

    public String getNoteType() {
        return this.noteType;
    }

    public void setNoteType(String noteType) {
        this.noteType = noteType;
    }

    public String getContent() {
        return this.content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Date getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
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

    public User getAuthor() {
        return this.author;
    }

    public void setAuthor(User author) {
        this.author = author;
    }

}
