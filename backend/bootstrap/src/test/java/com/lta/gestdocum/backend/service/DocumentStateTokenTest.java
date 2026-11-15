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
    void tokenIsStableAcrossTimestampPrecisionAndOffset() {
        UUID id = UUID.randomUUID();
        // In-memory value right after INSERT: nanoseconds, server zone.
        OffsetDateTime inMemory = OffsetDateTime.parse("2026-11-14T19:54:16.351017123-04:00");
        // Same instant as re-read from PostgreSQL timestamptz: microseconds, UTC.
        OffsetDateTime reloaded = OffsetDateTime.parse("2026-11-14T23:54:16.351017Z");

        assertEquals(DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, inMemory),
                DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, reloaded));
        assertNotEquals(DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, reloaded),
                DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, reloaded.plusNanos(1_000)));
    }

    @Test
    void tokenMatchesWhatPostgresStoresWhenNanosecondsRoundUp() {
        UUID id = UUID.randomUUID();
        // The driver rounds half-up to microseconds when persisting, so .351017600 is stored as .351018.
        OffsetDateTime inMemory = OffsetDateTime.parse("2026-11-14T19:54:16.351017600-04:00");
        OffsetDateTime stored = OffsetDateTime.parse("2026-11-14T23:54:16.351018Z");
        OffsetDateTime carry = OffsetDateTime.parse("2026-11-14T19:54:16.999999600-04:00");
        OffsetDateTime carried = OffsetDateTime.parse("2026-11-14T23:54:17.000000Z");

        assertEquals(DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, stored),
                DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, inMemory));
        assertEquals(DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, carried),
                DocumentStateToken.from(id, Document.DocumentStatus.DRAFT, null, carry));
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
