package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AuditClientIpTest {

    @Test
    @DisplayName("Toma la primera IP de X-Forwarded-For cuando es válida")
    void usesFirstForwardedIp() {
        assertEquals("203.0.113.7", AuditClientIp.resolve("203.0.113.7, 10.0.0.1", "10.0.0.1"));
        assertEquals("2001:db8::1", AuditClientIp.resolve("2001:db8::1", "10.0.0.1"));
    }

    @Test
    @DisplayName("Un X-Forwarded-For que no es una IP se descarta y se usa la IP de la conexión, para no perder el evento")
    void invalidForwardedFallsBackToRemote() {
        assertEquals("10.0.0.1", AuditClientIp.resolve("basura", "10.0.0.1"));
        assertEquals("10.0.0.1", AuditClientIp.resolve("999.1.1.1", "10.0.0.1"));
        assertEquals("10.0.0.1", AuditClientIp.resolve("1.2.3", "10.0.0.1"));
        assertEquals("10.0.0.1", AuditClientIp.resolve("<script>", "10.0.0.1"));
    }

    @Test
    @DisplayName("Sin ninguna IP válida queda 0.0.0.0, que la columna inet acepta")
    void unknownWhenNothingValid() {
        assertEquals(AuditClientIp.UNKNOWN, AuditClientIp.resolve(null, null));
        assertEquals(AuditClientIp.UNKNOWN, AuditClientIp.resolve("x", "y"));
    }
}
