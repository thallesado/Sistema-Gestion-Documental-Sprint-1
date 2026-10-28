package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.OffsetDateTime;
import java.util.List;

/** Read-only status of the scheduled external anchoring job. Never exposes paths, URLs or credentials. */
public record AuditAnchorJobStatus(
        boolean configured,
        String state,
        String message,
        String cron,
        List<String> destinationTypes,
        @JsonFormat(shape = JsonFormat.Shape.STRING) OffsetDateTime lastRunAt,
        String lastOutcome,
        int lastPublished,
        int lastFailed
) {}
