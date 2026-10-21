package com.lta.gestdocum.backend.dto;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Builder
public record ClinicalHistoryRevisionResponse(
        UUID id,
        UUID clinicalHistoryId,
        Integer revisionNumber,
        UUID authorId,
        String authorName,
        OffsetDateTime createdAt,
        String changeSummary,
        String snapshotData
) {
}
