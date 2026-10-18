package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
        recorder = new DefaultAuditRecorder(entityManager, userContext, objectMapper);
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
}
