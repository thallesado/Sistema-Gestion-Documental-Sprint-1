package com.lta.gestdocum.backend.dto;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class DocumentTypeResponse {
    UUID id;
    UUID categoryId;
    UUID retentionPolicyId;
    UUID workflowTemplateId;
    String name;
    String code;
    String description;
    Map<String, Object> metadataSchema;
    boolean active;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
