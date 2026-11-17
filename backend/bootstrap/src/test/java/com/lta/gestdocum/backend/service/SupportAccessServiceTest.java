package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.SupportAccessDtos.RequestCreate;
import com.lta.gestdocum.backend.dto.SupportAccessDtos.Session;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.security.JwtService;
import com.lta.gestdocum.backend.security.PlatformAuthorities;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Acceso de soporte: solo lectura, decidido por el tenant, sin impersonación. */
class SupportAccessServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformAuditService audit = mock(PlatformAuditService.class);
    private final AuthenticatedUserContext context = mock(AuthenticatedUserContext.class);
    private final JwtService jwt = new JwtService("0123456789abcdef0123456789abcdef-secret", 3_600_000L, 7_200_000L);
    private final UUID platformUser = UUID.randomUUID();
    private final UUID tenantId = UUID.randomUUID();
    private final UUID requestId = UUID.randomUUID();
    private SupportAccessService service;

    @BeforeEach
    void setUp() {
        when(audit.requirePlatformAccount()).thenReturn(new AuthenticatedUser(platformUser, null, "soporte",
                Set.of(PlatformAuthorities.BASE, PlatformAuthorities.SUPPORT_ACCESS)));
        service = new SupportAccessService(jdbc, audit, context, mock(EntityManager.class), jwt, null, "no-reply@test");
    }

    @Test
    void everyModuleGrantsOnlyReadPermissions() {
        SupportAccessService.MODULES.values().forEach(module -> module.permissions().forEach(code ->
                assertTrue(code.endsWith(":read") || code.equals("audit:read_tenant"), module.code() + " -> " + code)));
        assertEquals(List.of("configuration:read", "document:read", "document_version:read", "ocr:read", "tenant:read"),
                SupportAccessService.permissionsFor(List.of("DOCUMENTS")));
    }

    @Test
    void unknownModulesAndMissingReasonAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.request(new RequestCreate(tenantId, List.of("BACKUPS"), 60, false, "Revisar un error")));
        assertThrows(IllegalArgumentException.class, () -> service.request(new RequestCreate(tenantId, List.of("DOCUMENTS"), 60, false, "")));
        verify(jdbc, never()).update(contains("insert into support_access_requests"), any(Object[].class));
    }

    @Test
    void breakGlassNeedsASuperadminAndAnotherRole() {
        assertFalse(SupportAccessService.breakGlassReady(List.of("SUPERADMIN")));
        assertFalse(SupportAccessService.breakGlassReady(List.of("SUPERADMIN", "SUPERADMIN")));
        assertFalse(SupportAccessService.breakGlassReady(List.of("FINANCE", "OPERATIONS")));
        assertTrue(SupportAccessService.breakGlassReady(List.of("SUPERADMIN", "OPERATIONS")));
    }

    @Test
    void anApprovedRequestPastItsWindowIsExpired() {
        Map<String, Object> row = new HashMap<>();
        row.put("status", "APPROVED");
        row.put("expires_at", Timestamp.from(Instant.now().minus(1, ChronoUnit.MINUTES)));
        assertEquals("EXPIRED", SupportAccessService.displayStatus(row));
        row.put("expires_at", Timestamp.from(Instant.now().plus(10, ChronoUnit.MINUTES)));
        assertEquals("APPROVED", SupportAccessService.displayStatus(row));
    }

    private void storedRequest(UUID requestedBy, String status, Instant expires) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", requestId);
        row.put("tenant_id", tenantId);
        row.put("requested_by", requestedBy);
        row.put("status", status);
        row.put("break_glass", false);
        row.put("reason", "Revisar un documento que no abre");
        row.put("permission_codes", new String[] {"document:read", "tenant:read"});
        row.put("expires_at", expires == null ? null : Timestamp.from(expires));
        when(jdbc.queryForList(contains("from support_access_requests where id = ? for update"), eq(requestId))).thenReturn(List.of(row));
        Map<String, Object> tenant = new HashMap<>(Map.of("id", tenantId, "name", "Clínica Norte", "status", "ACTIVE"));
        tenant.put("purged_at", null);
        when(jdbc.queryForList(contains("from tenants where id = ?"), eq(tenantId))).thenReturn(List.of(tenant));
    }

    @Test
    void sessionIsTheRequesterOwnIdentityWithReadPermissionsOnly() {
        storedRequest(platformUser, "APPROVED", Instant.now().plus(30, ChronoUnit.MINUTES));
        Session session = service.startSession(requestId);
        AuthenticatedUser identity = jwt.extractAuthenticatedUser(session.token());
        assertEquals(platformUser, identity.userId(), "La sesión es de la cuenta de plataforma, nunca de un usuario del tenant");
        assertEquals(tenantId, identity.tenantId());
        assertEquals(requestId, identity.supportAccessId());
        assertEquals(Set.of("document:read", "tenant:read", PlatformAuthorities.SUPPORT_SESSION), identity.authorities());
        verify(audit).record(eq("SUPPORT_ACCESS_SESSION_STARTED"), eq(tenantId), anyString(), isNull(), anyMap());
    }

    @Test
    void onlyTheRequesterCanOpenTheSessionAndOnlyWhileApproved() {
        storedRequest(UUID.randomUUID(), "APPROVED", Instant.now().plus(30, ChronoUnit.MINUTES));
        assertThrows(AccessDeniedException.class, () -> service.startSession(requestId));
        storedRequest(platformUser, "PENDING_TENANT", null);
        assertThrows(IllegalStateException.class, () -> service.startSession(requestId));
        storedRequest(platformUser, "APPROVED", Instant.now().minus(1, ChronoUnit.MINUTES));
        assertThrows(IllegalStateException.class, () -> service.startSession(requestId));
    }

    @Test
    void aSupportSessionCannotDecideSupportAccess() {
        when(context.require()).thenReturn(new AuthenticatedUser(platformUser, tenantId, "soporte",
                Set.of("document:read", PlatformAuthorities.SUPPORT_SESSION), requestId));
        assertThrows(AccessDeniedException.class, () -> service.decide(requestId, "APPROVE", null));
    }

    @Test
    void aSupportTokenWithoutTenantIsRejected() {
        String token = jwt.generateSupportToken(platformUser, tenantId, "soporte", List.of("document:read"), requestId,
                Date.from(Instant.now().plus(5, ChronoUnit.MINUTES)));
        assertThrows(RuntimeException.class, () -> jwt.extractAuthenticatedUser(token), "Sin la marca support:session no es válido");
    }
}
