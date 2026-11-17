package com.lta.gestdocum.backend.service;

import java.util.Map;
import java.util.UUID;

/**
 * Registrador de auditoría semántica a nivel de entidad de negocio (C1).
 * Captura operaciones críticas (CREATE, UPDATE, DELETE, etc.) con sus estados
 * anteriores y posteriores ('before' y 'after'). Sanitiza credenciales y trunca
 * campos extensos automáticamente.
 */
public interface AuditRecorder {
    void record(String action, String entityType, UUID entityId,
                Map<String, Object> before, Map<String, Object> after);

    /**
     * Entidades con id numérico (roles): {@code entity_id} es uuid, así que el id viaja en los detalles como
     * {@code entityId} para que el evento siga identificando qué registro se tocó.
     */
    default void record(String action, String entityType, Long entityId,
                        Map<String, Object> before, Map<String, Object> after) {
        record(action, entityType, (UUID) null, withId(before, entityId), withId(after, entityId));
    }

    private static Map<String, Object> withId(Map<String, Object> values, Long entityId) {
        if (values == null || entityId == null) return values;
        Map<String, Object> copy = new java.util.LinkedHashMap<>(values);
        copy.putIfAbsent("entityId", entityId);
        return copy;
    }
}
