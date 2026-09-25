package com.lta.gestdocum.backend.modulos.auditoria.dto;

import java.util.UUID;

public record AuditActorResponse(UUID userId, String scope) {
}
