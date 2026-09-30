package com.lta.gestdocum.documentos.application.dto;

import com.lta.gestdocum.documentos.domain.model.Document;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record DocumentResponse(
        UUID id,
        UUID documentTypeId,
        UUID expedientId,
        UUID authorId,
        UUID responsibleId,
        UUID departmentId,
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
        OffsetDateTime updatedAt) {
}
