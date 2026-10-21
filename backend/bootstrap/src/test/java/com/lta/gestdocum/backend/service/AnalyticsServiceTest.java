package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private NamedParameterJdbcTemplate db;

    @Mock
    private AuthenticatedUserContext context;

    @InjectMocks
    private AnalyticsService analyticsService;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setup() {
        lenient().when(context.requireTenantId()).thenReturn(tenantId);
    }

    @Test
    @DisplayName("validateDateRange lanza IllegalArgumentException si dateFrom es nulo")
    void validateDateRange_nullDateFrom_throwsException() {
        OffsetDateTime dateTo = OffsetDateTime.now();
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                analyticsService.validateDateRange(null, dateTo));
        assertTrue(ex.getMessage().contains("obligatorio"));
    }

    @Test
    @DisplayName("validateDateRange lanza IllegalArgumentException si dateTo es nulo")
    void validateDateRange_nullDateTo_throwsException() {
        OffsetDateTime dateFrom = OffsetDateTime.now();
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                analyticsService.validateDateRange(dateFrom, null));
        assertTrue(ex.getMessage().contains("obligatorio"));
    }

    @Test
    @DisplayName("validateDateRange lanza IllegalArgumentException si dateFrom es posterior a dateTo")
    void validateDateRange_dateFromAfterDateTo_throwsException() {
        OffsetDateTime dateFrom = OffsetDateTime.parse("2026-10-02T00:00:00Z");
        OffsetDateTime dateTo = OffsetDateTime.parse("2026-10-01T00:00:00Z");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                analyticsService.validateDateRange(dateFrom, dateTo));
        assertTrue(ex.getMessage().contains("no puede ser posterior"));
    }

    @Test
    @DisplayName("validateDateRange pasa sin error con rango de fechas válido")
    void validateDateRange_validDates_passes() {
        OffsetDateTime dateFrom = OffsetDateTime.parse("2026-09-01T00:00:00Z");
        OffsetDateTime dateTo = OffsetDateTime.parse("2026-09-30T23:59:59Z");
        assertDoesNotThrow(() -> analyticsService.validateDateRange(dateFrom, dateTo));
    }
}
