package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
public class DocumentTypeRequest {

    @Size(max = 120)
    private String name;

    @Size(max = 50)
    private String code;

    @Size(max = 255)
    private String description;

    private UUID categoryId;
    private UUID retentionPolicyId;
    private UUID workflowTemplateId;
    private Map<String, Object> metadataSchema;
    private Boolean active;
}
