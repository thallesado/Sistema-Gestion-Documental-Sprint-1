package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class ChatResponseDTO {

    private String message;

    @JsonProperty("suggested_actions")
    private List<String> suggestedActions;

    private List<DocumentDTO> documents;

    private boolean success;

    private String error;

    public ChatResponseDTO() {}

    public ChatResponseDTO(String message, List<String> suggestedActions,
                          List<DocumentDTO> documents, boolean success) {
        this.message = message;
        this.suggestedActions = suggestedActions;
        this.documents = documents;
        this.success = success;
        this.error = null;
    }

    public ChatResponseDTO(String message, boolean success, String error) {
        this.message = message;
        this.success = success;
        this.error = error;
        this.suggestedActions = List.of();
        this.documents = List.of();
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public List<String> getSuggestedActions() {
        return suggestedActions;
    }

    public void setSuggestedActions(List<String> suggestedActions) {
        this.suggestedActions = suggestedActions;
    }

    public List<DocumentDTO> getDocuments() {
        return documents;
    }

    public void setDocuments(List<DocumentDTO> documents) {
        this.documents = documents;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
