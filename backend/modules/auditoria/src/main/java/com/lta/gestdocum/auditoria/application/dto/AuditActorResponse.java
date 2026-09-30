package com.lta.gestdocum.auditoria.application.dto;

import java.util.UUID;

public record AuditActorResponse(UUID userId, String scope) {
}
