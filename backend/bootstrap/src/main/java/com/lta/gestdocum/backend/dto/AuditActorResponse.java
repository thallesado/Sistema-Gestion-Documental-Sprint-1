package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record AuditActorResponse(UUID userId, String scope) {
}
