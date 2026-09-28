package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ChatRequestDTO {

    private String message;

    @JsonProperty("include_documents")
    private boolean includeDocuments;

    public ChatRequestDTO() {}

    public ChatRequestDTO(String message, boolean includeDocuments) {
        this.message = message;
        this.includeDocuments = includeDocuments;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public boolean isIncludeDocuments() {
        return includeDocuments;
    }

    public void setIncludeDocuments(boolean includeDocuments) {
        this.includeDocuments = includeDocuments;
    }
}
