package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DocumentDTO {

    private String id;

    @JsonProperty("document_number")
    private String documentNumber;

    private String title;

    private String description;

    @JsonProperty("document_type")
    private String documentType;

    private Double relevance;

    public DocumentDTO() {}

    public DocumentDTO(String id, String documentNumber, String title, String description,
                      String documentType, Double relevance) {
        this.id = id;
        this.documentNumber = documentNumber;
        this.title = title;
        this.description = description;
        this.documentType = documentType;
        this.relevance = relevance;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDocumentNumber() {
        return documentNumber;
    }

    public void setDocumentNumber(String documentNumber) {
        this.documentNumber = documentNumber;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDocumentType() {
        return documentType;
    }

    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }

    public Double getRelevance() {
        return relevance;
    }

    public void setRelevance(Double relevance) {
        this.relevance = relevance;
    }
}
