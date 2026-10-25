package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse;
import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse.*;
import com.lta.gestdocum.backend.service.AnalyticsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsControllerTest {

    @Mock
    private AnalyticsService analyticsService;

    @InjectMocks
    private AnalyticsController controller;

    private final OffsetDateTime dateFrom = OffsetDateTime.parse("2026-09-01T00:00:00Z");
    private final OffsetDateTime dateTo = OffsetDateTime.parse("2026-09-30T23:59:59Z");

    private final String fromText = "2026-09-01T00:00:00Z";
    private final String toText = "2026-09-30T23:59:59Z";

    @Test
    @DisplayName("Las fechas yyyy-MM-dd se interpretan en la zona horaria del tenant y los instantes ISO siguen funcionando")
    void dates_parsedInTenantZoneOrAsIsoInstant() {
        when(analyticsService.tenantZone()).thenReturn(java.time.ZoneId.of("America/La_Paz"));
        when(analyticsService.getSummary(any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(new AnalyticsSummary(1, 0, 0, 0, 0, 0, 0, 0));

        controller.getSummary("2026-09-01", "2026-09-30");
        controller.getSummary(fromText, toText);

        verify(analyticsService).getSummary(
                OffsetDateTime.parse("2026-09-01T00:00:00-04:00"), OffsetDateTime.parse("2026-09-30T23:59:59.999999999-04:00"));
        verify(analyticsService).getSummary(dateFrom, dateTo);
        assertThrows(IllegalArgumentException.class, () -> controller.getSummary(null, toText));
    }

    @Test
    @DisplayName("getDashboard delega al servicio y retorna 200 OK con payload completo")
    void getDashboard_validDates_returnsDashboard() {
        AnalyticsSummary summary = new AnalyticsSummary(100, 85.0, 40, 12.5, 15, 50, 92.0, 0.88);
        AnalyticsDashboardResponse response = new AnalyticsDashboardResponse(
                dateFrom, dateTo, summary, List.of(), List.of(), List.of(), List.of(),
                new OcrAnalytics(50, 46, 4, 92.0, 0.88, 3.2)
        );

        when(analyticsService.getDashboard(dateFrom, dateTo)).thenReturn(response);

        ResponseEntity<AnalyticsDashboardResponse> result = controller.getDashboard(fromText, toText);

        assertNotNull(result.getBody());
        assertEquals(100, result.getBody().summary().totalDocuments());
        assertEquals(85.0, result.getBody().summary().documentApprovalRate());
        verify(analyticsService).getDashboard(dateFrom, dateTo);
    }

    @Test
    @DisplayName("getSummary retorna métricas de resumen correctamente")
    void getSummary_returnsSummary() {
        AnalyticsSummary summary = new AnalyticsSummary(50, 80.0, 20, 8.0, 10, 30, 90.0, 0.85);
        when(analyticsService.getSummary(dateFrom, dateTo)).thenReturn(summary);

        ResponseEntity<AnalyticsSummary> result = controller.getSummary(fromText, toText);

        assertNotNull(result.getBody());
        assertEquals(50, result.getBody().totalDocuments());
        assertEquals(10, result.getBody().activeUsers());
    }

    @Test
    @DisplayName("getMonthlyTrend retorna serie de tiempo mensual")
    void getMonthlyTrend_returnsList() {
        MonthlyPoint point = new MonthlyPoint("2026-09", 30, 25, 15);
        when(analyticsService.getMonthlyTrend(dateFrom, dateTo)).thenReturn(List.of(point));

        ResponseEntity<List<MonthlyPoint>> result = controller.getMonthlyTrend(fromText, toText);

        assertEquals(1, result.getBody().size());
        assertEquals("2026-09", result.getBody().get(0).month());
        assertEquals(30, result.getBody().get(0).documentsCreated());
    }

    @Test
    @DisplayName("getWorkflowCycleTimes retorna métricas de tiempo por plantilla")
    void getWorkflowCycleTimes_returnsList() {
        WorkflowCycleTime ct = new WorkflowCycleTime("Aprobación Médica", 15, 6.5, 1.2, 18.0, 2);
        when(analyticsService.getWorkflowCycleTimes(dateFrom, dateTo)).thenReturn(List.of(ct));

        ResponseEntity<List<WorkflowCycleTime>> result = controller.getWorkflowCycleTimes(fromText, toText);

        assertEquals(1, result.getBody().size());
        assertEquals("Aprobación Médica", result.getBody().get(0).templateName());
        assertEquals(6.5, result.getBody().get(0).averageHours());
    }

    @Test
    @DisplayName("getTopUsers retorna usuarios más activos con límite configurable")
    void getTopUsers_returnsRanking() {
        TopUserActivity user = new TopUserActivity("Dr. Juan Pérez", "Médico", "Cirugía", 85, 12);
        when(analyticsService.getTopUsers(dateFrom, dateTo, 5)).thenReturn(List.of(user));

        ResponseEntity<List<TopUserActivity>> result = controller.getTopUsers(fromText, toText, 5);

        assertEquals(1, result.getBody().size());
        assertEquals("Dr. Juan Pérez", result.getBody().get(0).userName());
        assertEquals(85, result.getBody().get(0).auditActions());
    }

    @Test
    @DisplayName("getOcrPerformance retorna estadísticas agregadas de OCR")
    void getOcrPerformance_returnsMetrics() {
        OcrAnalytics ocr = new OcrAnalytics(40, 36, 4, 90.0, 0.87, 2.8);
        when(analyticsService.getOcrPerformance(dateFrom, dateTo)).thenReturn(ocr);

        ResponseEntity<OcrAnalytics> result = controller.getOcrPerformance(fromText, toText);

        assertEquals(40, result.getBody().totalProcessed());
        assertEquals(90.0, result.getBody().acceptanceRate());
    }
}
