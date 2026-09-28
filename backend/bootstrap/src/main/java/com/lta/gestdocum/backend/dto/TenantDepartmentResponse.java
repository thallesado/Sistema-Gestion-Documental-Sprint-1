package com.lta.gestdocum.backend.dto;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class TenantDepartmentResponse {
    UUID id;
    String name;
    String code;
    String description;
    boolean active;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
