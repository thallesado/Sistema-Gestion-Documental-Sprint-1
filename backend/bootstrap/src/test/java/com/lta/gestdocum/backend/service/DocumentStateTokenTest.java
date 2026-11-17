package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.Document;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class DocumentStateTokenTest {
    @Test
    void tokenChangesWhenDocumentStatusOrVersionChanges() {
        UUID id = UUID.randomUUID();
        OffsetDateTime updated = OffsetDateTime.parse("2026-11-06T10:00:00Z");
        String draft = DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, 1, updated);

        assertNotEquals(draft, DocumentStateToken.from(id, Document.DocumentStatus.APPROVED, 1, updated));
        assertNotEquals(draft, DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, 2, updated));
        assertTrue(draft.startsWith("\"") && draft.endsWith("\""));
    }

    @Test
    void requiresCurrentTokenForStateMutations() {
        Document current = new Document(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "DOC-1", "Test");
        current.setId(UUID.randomUUID());
        current.setCurrentVersion(3);
        current.setUpdatedAt(OffsetDateTime.parse("2026-11-06T10:00:00Z"));
        String token = DocumentStateToken.from(current);

        assertDoesNotThrow(() -> DocumentStateToken.requireMatch(token, current));
        assertEquals(428, assertThrows(ResponseStatusException.class,
                () -> DocumentStateToken.requireMatch(null, current)).getStatusCode().value());
        assertEquals(412, assertThrows(ResponseStatusException.class,
                () -> DocumentStateToken.requireMatch("\"stale\"", current)).getStatusCode().value());
    }
}
