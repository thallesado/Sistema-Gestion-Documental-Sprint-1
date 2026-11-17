package com.lta.gestdocum.backend.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ClinicalHistoryDeletionResponse(UUID id, String code, UUID patientId,
                                             OffsetDateTime deletedAt, String reason, UUID deletedBy) { }
