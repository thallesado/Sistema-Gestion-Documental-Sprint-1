package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.Document;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record DocumentResponse(
        UUID id,
        UUID documentTypeId,
        UUID expedientId,
        UUID authorId,
        UUID responsibleId,
        UUID departmentId,
        UUID patientId,
        String specialty,
        String institutionalProcess,
        Map<String, Object> metadata,
        String code,
        String name,
        String description,
        Document.DocumentStatus status,
        Integer currentVersion,
        LocalDate issueDate,
        LocalDate expiryDate,
        Boolean externalSource,
        String source,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String documentTypeName,
        String documentTypeCode,
        String categoryName,
        String departmentName,
        String authorName,
        String responsibleName,
        String patientName,
        String expedientCode) {
}
