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

import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse.AreaDistribution;
import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse.TopUserActivity;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
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

    private final OffsetDateTime from = OffsetDateTime.parse("2026-09-01T00:00:00Z");
    private final OffsetDateTime to = OffsetDateTime.parse("2026-09-30T23:59:59Z");

    private static ResultSet row(String area, String column, long value) throws Exception {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("area_name")).thenReturn(area);
        when(rs.getLong(column)).thenReturn(value);
        return rs;
    }

    @Test
    @DisplayName("getAreaDistribution rellena workflowCount con una segunda consulta y fusiona por área")
    void getAreaDistribution_mergesWorkflowCounts() throws Exception {
        doAnswer(inv -> {
            String sql = inv.getArgument(0);
            RowCallbackHandler handler = inv.getArgument(2);
            if (sql.contains("workflow_documents")) {
                handler.processRow(row("Cirugía", "workflow_count", 4));
                handler.processRow(row("Archivo", "workflow_count", 2));
            } else {
                handler.processRow(row("Cirugía", "doc_count", 10));
                handler.processRow(row("Dirección", "doc_count", 3));
            }
            return null;
        }).when(db).query(anyString(), any(SqlParameterSource.class), any(RowCallbackHandler.class));

        List<AreaDistribution> result = analyticsService.getAreaDistribution(from, to);

        assertEquals(List.of(
                new AreaDistribution("Cirugía", 10, 4),
                new AreaDistribution("Dirección", 3, 0),
                new AreaDistribution("Archivo", 0, 2)), result);
    }

    @Test
    @DisplayName("getTopUsers usa subconsultas escalares (sin multiplicar por roles) y devuelve documentsCreated")
    void getTopUsers_usesScalarSubqueriesAndDocumentsCreated() throws Exception {
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            assertFalse(sql.contains("LEFT JOIN user_roles"), sql);
            assertFalse(sql.contains("JOIN audit_events a ON"), sql);
            assertTrue(sql.contains("d.author_id = u.id"), sql);
            RowMapper<?> mapper = inv.getArgument(2);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getString("full_name")).thenReturn("Laura Pérez");
            when(rs.getString("role_name")).thenReturn("Admin");
            when(rs.getString("area_name")).thenReturn("General");
            when(rs.getLong("audit_actions")).thenReturn(9L);
            when(rs.getLong("documents_created")).thenReturn(5L);
            return List.of(mapper.mapRow(rs, 0));
        });

        List<TopUserActivity> result = analyticsService.getTopUsers(from, to, 5);

        assertEquals(new TopUserActivity("Laura Pérez", "Admin", "General", 9, 5), result.get(0));
    }

    @Test
    @DisplayName("getMonthlyTrend agrupa por mes en la zona horaria del tenant")
    void getMonthlyTrend_groupsInTenantZone() {
        when(db.queryForList(anyString(), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of("America/La_Paz"));
        doAnswer(inv -> {
            String sql = inv.getArgument(0);
            SqlParameterSource params = inv.getArgument(1);
            assertTrue(sql.contains("AT TIME ZONE :tz"), sql);
            assertEquals("America/La_Paz", params.getValue("tz"));
            return null;
        }).when(db).query(anyString(), any(SqlParameterSource.class), any(RowCallbackHandler.class));

        assertTrue(analyticsService.getMonthlyTrend(from, to).isEmpty());
    }
}
