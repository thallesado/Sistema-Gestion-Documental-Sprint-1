package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PlatformAuditServiceTest {
    private final NamedParameterJdbcTemplate db = mock(NamedParameterJdbcTemplate.class);
    private final AuthenticatedUserContext context = mock(AuthenticatedUserContext.class);
    private PlatformAuditService service;
    private final UUID actor = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PlatformAuditService(db, context, new ObjectMapper());
        when(context.require()).thenReturn(new AuthenticatedUser(actor, null, "superadmin", Set.of("platform:tenant:manage")));
    }

    @Test
    void reasonIsMandatoryAndNormalized() {
        assertThrows(IllegalArgumentException.class, () -> PlatformAuditService.requireReason(null));
        assertThrows(IllegalArgumentException.class, () -> PlatformAuditService.requireReason("   "));
        assertThrows(IllegalArgumentException.class, () -> PlatformAuditService.requireReason("abc"));
        assertThrows(IllegalArgumentException.class, () -> PlatformAuditService.requireReason("x".repeat(1001)));
        assertEquals("Pago confirmado por banco", PlatformAuditService.requireReason("  Pago   confirmado\npor banco "));
    }

    @Test
    void recordWithoutReasonWritesNothing() {
        UUID tenant = UUID.randomUUID();
        assertThrows(IllegalArgumentException.class, () -> service.record("TENANT_SUSPENDED", tenant, "", null, null));
        assertThrows(IllegalArgumentException.class, () -> service.record("UNKNOWN_ACTION", tenant, "Motivo válido", null, null));
        verifyNoInteractions(db);
    }

    @Test
    void tenantAccountsCannotRecordOrRead() {
        when(context.require()).thenReturn(new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "tenant-admin",
                Set.of("platform:tenant:manage")));
        assertThrows(AccessDeniedException.class, () -> service.record("TENANT_SUSPENDED", null, "Motivo válido", null, null));
        assertThrows(AccessDeniedException.class, () -> service.search(Map.of(), 1, 20));
        assertThrows(AccessDeniedException.class, () -> service.exportCsv(Map.of()));
        verifyNoInteractions(db);
    }

    @Test
    void recordStoresActorReasonAndStates() {
        UUID tenant = UUID.randomUUID();
        service.record("TENANT_TRIAL_EXTENDED", tenant, " Cliente pidió más tiempo ", Map.of("status", "TRIAL"), Map.of("days", 7));
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(db).update(sql.capture(), params.capture());
        assertTrue(sql.getValue().trim().startsWith("insert into platform_audit_events"));
        assertEquals(actor, params.getValue().getValue("actor"));
        assertEquals("superadmin", params.getValue().getValue("username"));
        assertEquals(tenant, params.getValue().getValue("tenant"));
        assertEquals("Cliente pidió más tiempo", params.getValue().getValue("reason"));
        assertEquals("{\"status\":\"TRIAL\"}", params.getValue().getValue("before"));
        assertEquals("{\"days\":7}", params.getValue().getValue("after"));
    }

    /** Inmutabilidad: el servicio solo inserta y la migración bloquea UPDATE, DELETE y TRUNCATE. */
    @Test
    void auditIsAppendOnly() throws Exception {
        for (Method method : PlatformAuditService.class.getDeclaredMethods()) {
            if (!Modifier.isPublic(method.getModifiers())) continue;
            String name = method.getName().toLowerCase(Locale.ROOT);
            assertFalse(name.contains("update") || name.contains("delete") || name.contains("remove"),
                    "PlatformAuditService must not expose " + method.getName());
        }
        Path migration = Path.of("../../database/init/062_platform_audit.sql");
        if (!Files.exists(migration)) migration = Path.of("../database/init/062_platform_audit.sql");
        // La imagen Docker del backend solo copia backend/: ahí la migración la cubre scripts/tests/platform-audit.sql.
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.exists(migration), "database/init no disponible en este build");
        String sql = Files.readString(migration);
        assertTrue(sql.contains("BEFORE UPDATE ON public.platform_audit_events"));
        assertTrue(sql.contains("BEFORE DELETE ON public.platform_audit_events"));
        assertTrue(sql.contains("BEFORE TRUNCATE ON public.platform_audit_events"));
        assertTrue(sql.contains("REVOKE ALL ON public.platform_audit_events FROM nexodocs_app"));
    }

    @Test
    void filtersAreValidatedAndBound() {
        assertThrows(IllegalArgumentException.class, () -> service.search(Map.of("action", "DROP TABLE"), 1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.search(Map.of("tenantId", "x' or 1=1"), 1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.search(Map.of("dateFrom", "2026-02-01", "dateTo", "2026-01-01"), 1, 20));
        when(db.queryForObject(anyString(), any(MapSqlParameterSource.class), eq(Long.class))).thenReturn(0L);
        when(db.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(List.of());
        service.search(new HashMap<>(Map.of("actor", "x' or '1'='1")), 1, 999);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(db).queryForList(sql.capture(), params.capture());
        assertFalse(sql.getValue().contains("'1'='1"));
        assertEquals(200, params.getValue().getValue("limit"));
    }
}
