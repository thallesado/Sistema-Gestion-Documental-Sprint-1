package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DocumentTranslationServiceTest {

    @Mock private NamedParameterJdbcTemplate db;
    @Mock private JdbcTemplate jdbc;
    @Mock private PlatformTransactionManager transactions;
    @Mock private DocumentStorageService storage;
    @Mock private DocumentService documents;

    private DocumentTranslationService service;

    @BeforeEach
    void setUp() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        var user = new AuthenticatedUser(userId, tenantId, "revisor",
                Set.of("translation:read", "translation:review", "translation:create"));
        var authentication = new UsernamePasswordAuthenticationToken(user, null, List.of());
        var contextHolder = SecurityContextHolder.createEmptyContext();
        contextHolder.setAuthentication(authentication);
        SecurityContextHolder.setContext(contextHolder);

        when(transactions.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        when(jdbc.queryForObject(eq("SELECT app.has_permission(?)"), eq(Boolean.class), any())).thenReturn(true);
        lenient().when(db.queryForList(anyString(), anyMap())).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.contains("translation_segments")) {
                return List.of(Map.of("source_text", "texto secreto origen"));
            }
            return List.of(Map.of("id", UUID.randomUUID(), "document_name", "Contrato secreto"));
        });
        lenient().when(db.update(anyString(), anyMap())).thenReturn(1);

        var operations = new DocumentOperations(db, jdbc, new ObjectMapper(), new AuthenticatedUserContext(), transactions);
        service = new DocumentTranslationService(operations, storage, documents, null);
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void updateSegmentRejectsDocumentTextWithoutDocumentRead() {
        assertThrows(AccessDeniedException.class,
                () -> service.updateSegment(UUID.randomUUID(), UUID.randomUUID(), "revisado", "MODIFIED"));
        verify(db, never()).update(anyString(), anyMap());
    }

    @Test
    void updateSegmentMissingRowIsNotFoundAndDoesNotAudit() {
        var user = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "revisor",
                Set.of("translation:read", "translation:review", "document:read"));
        var holder = SecurityContextHolder.createEmptyContext();
        holder.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
        SecurityContextHolder.setContext(holder);
        when(db.queryForList(anyString(), anyMap())).thenReturn(List.of(Map.of("id", UUID.randomUUID())));
        when(db.update(anyString(), anyMap())).thenReturn(0);
        var local = new DocumentTranslationService(
                new DocumentOperations(db, jdbc, new ObjectMapper(), new AuthenticatedUserContext(), transactions),
                storage, documents, null);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> local.updateSegment(UUID.randomUUID(), UUID.randomUUID(), "revisado", "MODIFIED"));

        assertEquals(HttpStatus.NOT_FOUND.value(), error.getStatusCode().value());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void cancelRejectsDocumentTextWithoutDocumentRead() {
        assertThrows(AccessDeniedException.class,
                () -> service.cancel(UUID.randomUUID(), "no corresponde"));
        verify(db, never()).update(anyString(), anyMap());
    }
}
