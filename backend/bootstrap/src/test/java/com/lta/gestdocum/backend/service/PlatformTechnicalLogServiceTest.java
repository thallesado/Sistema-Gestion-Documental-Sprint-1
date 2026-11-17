package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PlatformTechnicalLogServiceTest {
    @Test
    void requestPathDropsQueriesAndRedactsIdentifiers() {
        assertEquals("/api/v1/patients/:id/notes/:id", PlatformTechnicalLogService.sanitizePath(
                "/api/v1/patients/70000000-0000-0000-0000-000000000001/notes/42?name=private#fragment"));
    }

    @Test
    void requestPathKeepsStaticRoutesAndBoundsLength() {
        assertEquals("/api/v1/documents", PlatformTechnicalLogService.sanitizePath("/api/v1/documents"));
        assertEquals(200, PlatformTechnicalLogService.sanitizePath("/" + "x".repeat(240)).length());
        assertNull(PlatformTechnicalLogService.sanitizePath(null));
    }
}
