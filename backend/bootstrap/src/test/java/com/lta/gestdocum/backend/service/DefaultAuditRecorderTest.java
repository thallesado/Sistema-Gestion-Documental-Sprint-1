package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DefaultAuditRecorderTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private AuthenticatedUserContext userContext;

    @Mock
    private Query query;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private DefaultAuditRecorder recorder;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
        recorder = new DefaultAuditRecorder(entityManager, userContext, objectMapper);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }

    /** Simula la transacción de negocio abierta (p. ej. UserService.createUser). */
    private void openBusinessTransaction() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }

    private AuthenticatedUser tenantUser() {
        AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "diego", Set.of("ROLE_USER"));
        when(userContext.require()).thenReturn(user);
        return user;
    }

    @Test
    @DisplayName("sanitizeMap enmascara contraseñas, tokens y claves sensibles")
    void testSanitizeMapMasksSensitiveKeys() {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("username", "diego");
        input.put("password", "super-secret-123");
        input.put("passwordHash", "$2a$12$e0MYzXy8V...");
        input.put("api_key", "AIzaSyD-abc");
        input.put("token", "eyJhbGciOi...");
        input.put("refreshToken", "d8f76s5d...");
        input.put("nested", Map.of("secretKey", "xyz123", "normal", "ok"));

        Map<String, Object> sanitized = recorder.sanitizeMap(input);

        assertEquals("diego", sanitized.get("username"));
        assertEquals("[PROTECTED]", sanitized.get("password"));
        assertEquals("[PROTECTED]", sanitized.get("passwordHash"));
        assertEquals("[PROTECTED]", sanitized.get("api_key"));
        assertEquals("[PROTECTED]", sanitized.get("token"));
        assertEquals("[PROTECTED]", sanitized.get("refreshToken"));

        @SuppressWarnings("unchecked")
        Map<String, Object> nested = (Map<String, Object>) sanitized.get("nested");
        assertEquals("[PROTECTED]", nested.get("secretKey"));
        assertEquals("ok", nested.get("normal"));
    }

    @Test
    @DisplayName("sanitizeMap trunca strings excesivamente largos (>300 caracteres)")
    void testSanitizeMapTruncatesLongStrings() {
        String longText = "A".repeat(500);
        Map<String, Object> input = Map.of("content", longText);

        Map<String, Object> sanitized = recorder.sanitizeMap(input);
        String result = (String) sanitized.get("content");

        assertTrue(result.length() < 350);
        assertTrue(result.endsWith("... [TRUNCATED]"));
        assertTrue(result.startsWith("AAAAA"));
    }

    @Test
    @DisplayName("record no lanza excepción cuando no hay usuario autenticado")
    void testRecordWithoutUserDoesNotThrow() {
        when(userContext.require()).thenThrow(new IllegalStateException("Sin usuario"));
        assertDoesNotThrow(() -> recorder.record("CREATE", "DOCUMENTS", UUID.randomUUID(), null, Map.of("title", "Doc")));
        verify(entityManager, never()).createNativeQuery(anyString());
    }

    @Test
    @DisplayName("record ejecuta app.record_http_access con tenantId y parámetros adecuados")
    void testRecordWithTenantExecutesNativeQuery() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID entityId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(userId, tenantId, "diego", Set.of("ROLE_USER"));

        when(userContext.require()).thenReturn(user);
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(null);

        Map<String, Object> before = Map.of("status", "DRAFT");
        Map<String, Object> after = Map.of("status", "APPROVED");

        recorder.record("UPDATE", "DOCUMENTS", entityId, before, after);

        verify(userContext).establishDatabaseContext(user);
        verify(query).setParameter("action", "UPDATE");
        verify(query).setParameter("entityType", "DOCUMENTS");
        verify(query).setParameter("entityId", entityId);
        verify(query).setParameter("result", "SUCCESS");
        verify(query).getSingleResult();
    }

    @Test
    @DisplayName("dentro de una transacción no escribe hasta el commit (evita el interbloqueo con la cadena de hashes)")
    void testRecordInsideTransactionWritesAfterCommit() {
        AuthenticatedUser user = tenantUser();
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        openBusinessTransaction();

        recorder.record("CREATE", "USERS", UUID.randomUUID(), null, Map.of("username", "ana"));

        verify(entityManager, never()).createNativeQuery(anyString());
        List<TransactionSynchronization> pending = TransactionSynchronizationManager.getSynchronizations();
        assertEquals(1, pending.size());

        pending.forEach(TransactionSynchronization::afterCommit);

        verify(userContext).establishDatabaseContext(user);
        verify(query).setParameter("action", "CREATE");
        verify(query).getSingleResult();
    }

    @Test
    @DisplayName("si la operación se revierte no queda evento de auditoría")
    void testRecordInsideTransactionSkipsOnRollback() {
        tenantUser();
        openBusinessTransaction();

        recorder.record("CREATE", "USERS", UUID.randomUUID(), null, Map.of("username", "ana"));
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

        verify(entityManager, never()).createNativeQuery(anyString());
    }

    @Test
    @DisplayName("un fallo al escribir tras el commit se registra en el log y no se propaga")
    void testRecordAfterCommitFailureDoesNotPropagate() {
        tenantUser();
        when(entityManager.createNativeQuery(anyString())).thenThrow(new IllegalStateException("BD caída"));
        openBusinessTransaction();

        recorder.record("CREATE", "USERS", UUID.randomUUID(), null, null);

        assertDoesNotThrow(() -> TransactionSynchronizationManager.getSynchronizations()
                .forEach(TransactionSynchronization::afterCommit));
    }
}
