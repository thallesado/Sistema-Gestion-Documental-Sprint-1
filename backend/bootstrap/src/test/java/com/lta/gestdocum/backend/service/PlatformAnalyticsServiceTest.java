package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlatformAnalyticsServiceTest {
    @Mock private NamedParameterJdbcTemplate db;
    @Mock private AuthenticatedUserContext context;
    @Mock private AuthenticatedUser user;
    private PlatformAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new PlatformAnalyticsService(db, context, new BigDecimal("2.9"), new BigDecimal("0.30"), BigDecimal.ZERO, BigDecimal.ONE);
        when(context.require()).thenReturn(user);
        when(user.tenantId()).thenReturn(null);
    }

    @Test
    void tenantAccountsCannotReadPlatformData() {
        when(user.tenantId()).thenReturn(UUID.randomUUID());
        assertThrows(AccessDeniedException.class, () -> service.dashboard());
        assertThrows(AccessDeniedException.class, () -> service.report("tenants", filters("2026-01-01", "2026-01-31"), 1, 10));
        verifyNoInteractions(db);
    }

    @Test
    void reportsRequireDateRangeAndKnownType() {
        assertThrows(IllegalArgumentException.class, () -> service.report("tenants", filters(null, "2026-01-31"), 1, 10));
        assertThrows(IllegalArgumentException.class, () -> service.report("tenants", filters("2026-02-01", "2026-01-01"), 1, 10));
        assertThrows(IllegalArgumentException.class, () -> service.report("documents", filters("2026-01-01", "2026-01-31"), 1, 10));
    }

    @Test
    void reportFiltersAreBoundAsParametersNotConcatenated() {
        when(db.queryForObject(anyString(), any(MapSqlParameterSource.class), eq(Long.class))).thenReturn(1L);
        when(db.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(List.of(new HashMap<>(Map.of("tenant", "Clínica"))));
        Map<String, String> f = filters("2026-01-01", "2026-01-31");
        f.put("search", "x' or '1'='1");
        f.put("status", "ACTIVE");

        assertEquals(1, service.report("tenants", f, 1, 500).totalElements());

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<MapSqlParameterSource> params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(db).queryForList(sql.capture(), params.capture());
        assertFalse(sql.getValue().contains("'1'='1"));
        assertEquals("%x' or '1'='1%", params.getValue().getValue("search"));
        assertEquals(200, params.getValue().getValue("limit"), "page size is capped");
    }

    @Test
    void unknownStatusOrMethodIsRejected() {
        Map<String, String> f = filters("2026-01-01", "2026-01-31");
        f.put("status", "HACKED");
        assertThrows(IllegalArgumentException.class, () -> service.report("tenants", f, 1, 10));
        Map<String, String> p = filters("2026-01-01", "2026-01-31");
        p.put("type", "PAYPAL");
        assertThrows(IllegalArgumentException.class, () -> service.report("payments", p, 1, 10));
    }

    private static Map<String, String> filters(String from, String to) {
        Map<String, String> filters = new HashMap<>();
        filters.put("dateFrom", from);
        filters.put("dateTo", to);
        return filters;
    }
}
