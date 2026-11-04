package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class AuditRecorderNumericIdTest {

    @Test
    @DisplayName("Un evento de una entidad con id numérico (roles) conserva el id en los detalles antes y después")
    void numericIdTravelsInDetails() {
        List<Map<String, Object>> captured = new ArrayList<>();
        AuditRecorder recorder = (action, type, id, before, after) -> {
            assertNull(id, "entity_id es uuid; el id numérico no cabe ahí");
            captured.add(before);
            captured.add(after);
        };

        recorder.record("UPDATE", "ROLES", 42L, Map.of("name", "Archivo"), Map.of("name", "Archivo central"));

        assertEquals(42L, captured.get(0).get("entityId"));
        assertEquals("Archivo central", captured.get(1).get("name"));
        assertEquals(42L, captured.get(1).get("entityId"));
    }

    @Test
    @DisplayName("Sin estado previo (alta) no se inventa un mapa antes")
    void nullBeforeStaysNull() {
        List<Map<String, Object>> captured = new ArrayList<>();
        AuditRecorder recorder = (action, type, id, before, after) -> {
            captured.add(before);
            captured.add(after);
        };
        recorder.record("CREATE", "ROLES", 7L, null, Map.of("name", "Nuevo"));
        assertNull(captured.get(0));
        assertEquals(7L, captured.get(1).get("entityId"));
        UUID unused = null;
        assertNull(unused);
    }
}
