package com.lta.gestdocum.backend.dto;

import java.time.OffsetDateTime;
import java.util.Set;

public record AuditEventFilter(
        String action,
        String entityType,
        String result,
        OffsetDateTime from,
        OffsetDateTime to
) {
    private static final String FILTER_PATTERN = "[A-Za-z0-9:_-]+";
    private static final Set<String> RESULTS = Set.of("SUCCESS", "FAILURE");

    public AuditEventFilter {
        action = normalizeAndValidate(action, 80, "acción");
        entityType = normalizeAndValidate(entityType, 60, "tipo");
        result = normalizeResult(result);
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("El filtro 'from' debe ser anterior o igual a 'to'");
        }
    }

    private static String normalizeAndValidate(String value, int maximumLength, String name) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maximumLength || !normalized.matches(FILTER_PATTERN)) {
            throw new IllegalArgumentException("Formato de " + name + " inválido");
        }
        return normalized;
    }

    private static String normalizeResult(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (!RESULTS.contains(normalized)) {
            throw new IllegalArgumentException("Resultado inválido");
        }
        return normalized;
    }
}
