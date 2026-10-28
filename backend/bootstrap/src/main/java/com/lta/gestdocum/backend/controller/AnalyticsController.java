package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse;
import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse.*;
import com.lta.gestdocum.backend.dto.ReportFilterRequest;
import com.lta.gestdocum.backend.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/reports/analytics")
@Tag(name = "Analítica y Business Intelligence", description = "Endpoints de agregaciones reales para reportes y tableros BI")
@SecurityRequirement(name = "BearerAuth")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    /** Acepta yyyy-MM-dd (en la zona del tenant) o un instante ISO-8601 con desplazamiento. */
    private OffsetDateTime parse(String text, boolean endOfDay) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("El rango de fechas (dateFrom y dateTo) es obligatorio para la analítica.");
        }
        return ReportFilterRequest.parseDateTime(text, endOfDay, analyticsService.tenantZone());
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Tablero analítico integral", description = "Resumen de indicadores clave, series temporales, tiempos de ciclo, áreas y OCR con filtros obligatorios de fechas")
    public ResponseEntity<AnalyticsDashboardResponse> getDashboard(
            @RequestParam("dateFrom") String dateFrom,
            @RequestParam("dateTo") String dateTo
    ) {
        return ResponseEntity.ok(analyticsService.getDashboard(parse(dateFrom, false), parse(dateTo, true)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Indicadores clave (KPIs)", description = "Agregaciones de volumen, tasas de aprobación, tiempos de resolución y usuarios activos")
    public ResponseEntity<AnalyticsSummary> getSummary(
            @RequestParam("dateFrom") String dateFrom,
            @RequestParam("dateTo") String dateTo
    ) {
        return ResponseEntity.ok(analyticsService.getSummary(parse(dateFrom, false), parse(dateTo, true)));
    }

    @GetMapping("/monthly")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Tendencia mensual", description = "Evolución mes a mes de documentos creados, aprobados y workflows completados")
    public ResponseEntity<List<MonthlyPoint>> getMonthlyTrend(
            @RequestParam("dateFrom") String dateFrom,
            @RequestParam("dateTo") String dateTo
    ) {
        return ResponseEntity.ok(analyticsService.getMonthlyTrend(parse(dateFrom, false), parse(dateTo, true)));
    }

    @GetMapping("/by-area")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Distribución por área o departamento", description = "Volumen documental y de procesos agrupados por departamento institucional")
    public ResponseEntity<List<AreaDistribution>> getAreaDistribution(
            @RequestParam("dateFrom") String dateFrom,
            @RequestParam("dateTo") String dateTo
    ) {
        return ResponseEntity.ok(analyticsService.getAreaDistribution(parse(dateFrom, false), parse(dateTo, true)));
    }

    @GetMapping("/workflow-cycle-times")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Tiempos de ciclo de workflows", description = "Promedio de horas de resolución, métricas de atraso y cuellos de botella por plantilla de workflow")
    public ResponseEntity<List<WorkflowCycleTime>> getWorkflowCycleTimes(
            @RequestParam("dateFrom") String dateFrom,
            @RequestParam("dateTo") String dateTo
    ) {
        return ResponseEntity.ok(analyticsService.getWorkflowCycleTimes(parse(dateFrom, false), parse(dateTo, true)));
    }

    @GetMapping("/top-users")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Usuarios con mayor actividad operativa", description = "Ranking de actividad por eventos auditados en el período sin fines punitivos")
    public ResponseEntity<List<TopUserActivity>> getTopUsers(
            @RequestParam("dateFrom") String dateFrom,
            @RequestParam("dateTo") String dateTo,
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(analyticsService.getTopUsers(parse(dateFrom, false), parse(dateTo, true), limit));
    }

    @GetMapping("/ocr-performance")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Métricas de aceptación y rendimiento OCR", description = "Efectividad del motor IA, porcentaje de validación vs rechazo y confianza media")
    public ResponseEntity<OcrAnalytics> getOcrPerformance(
            @RequestParam("dateFrom") String dateFrom,
            @RequestParam("dateTo") String dateTo
    ) {
        return ResponseEntity.ok(analyticsService.getOcrPerformance(parse(dateFrom, false), parse(dateTo, true)));
    }
}
