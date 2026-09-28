package com.lta.gestdocum.backend.dto;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AuditEventFilterTest {

    @Test
    void normalizesEmptyFiltersWithoutWideningTheTenantScope() {
        AuditEventFilter filters = new AuditEventFilter("  HTTP_GET  ", "  DOCUMENT  ",
                "SUCCESS", null, null);

        assertEquals("HTTP_GET", filters.action());
        assertEquals("DOCUMENT", filters.entityType());
        assertEquals("SUCCESS", filters.result());
        assertNull(new AuditEventFilter(" ", " ", " ", null, null).action());
    }

    @Test
    void rejectsUnsafeValuesAndInvalidDateRanges() {
        assertThrows(IllegalArgumentException.class,
                () -> new AuditEventFilter("HTTP GET", null, null, null, null));
        assertThrows(IllegalArgumentException.class,
                () -> new AuditEventFilter(null, "DOCUMENT", "UNKNOWN", null, null));
        assertThrows(IllegalArgumentException.class,
                () -> new AuditEventFilter(null, null, null,
                        OffsetDateTime.parse("2026-09-02T00:00:00Z"),
                        OffsetDateTime.parse("2026-09-01T00:00:00Z")));
    }
}
