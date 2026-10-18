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

    default void record(String action, String entityType, Long entityId,
                        Map<String, Object> before, Map<String, Object> after) {
        record(action, entityType, (UUID) null, before, after);
    }
}
