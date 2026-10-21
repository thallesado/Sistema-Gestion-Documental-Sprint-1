package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/v1/reports")
@Validated
@Tag(name = "Reportes Reales", description = "Reportes con filtros obligatorios y exportación sobre los datos del tenant")
@SecurityRequirement(name = "BearerAuth")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/documents")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Reporte de documentos", description = "Requiere rango de fechas (dateFrom y dateTo). Paginación en servidor.")
    public ResponseEntity<ReportPageResponse<DocumentReportRow>> getDocuments(
            @RequestParam(name = "dateFrom") String dateFrom,
            @RequestParam(name = "dateTo") String dateTo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        ReportFilterRequest filter = ReportFilterRequest.of(dateFrom, dateTo, status, type, area, owner, null, null, null, search);
        return ResponseEntity.ok(reportService.getDocumentsReport(filter, page, size));
    }

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Reporte de usuarios", description = "Requiere rango de fechas. Actividad y accesos reales del tenant.")
    public ResponseEntity<ReportPageResponse<UserReportRow>> getUsers(
            @RequestParam(name = "dateFrom") String dateFrom,
            @RequestParam(name = "dateTo") String dateTo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String owner,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        ReportFilterRequest filter = ReportFilterRequest.of(dateFrom, dateTo, status, null, area, owner, null, null, null, null);
        return ResponseEntity.ok(reportService.getUsersReport(filter, page, size));
    }

    @GetMapping("/workflows")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Reporte de flujos de trabajo", description = "Requiere rango de fechas. Estado, etapas y tiempos reales.")
    public ResponseEntity<ReportPageResponse<WorkflowReportRow>> getWorkflows(
            @RequestParam(name = "dateFrom") String dateFrom,
            @RequestParam(name = "dateTo") String dateTo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String owner,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        ReportFilterRequest filter = ReportFilterRequest.of(dateFrom, dateTo, status, type, null, owner, null, null, null, null);
        return ResponseEntity.ok(reportService.getWorkflowsReport(filter, page, size));
    }

    @GetMapping("/expedients")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Reporte de expedientes", description = "Requiere rango de fechas. Estado y tipos de expedientes reales.")
    public ResponseEntity<ReportPageResponse<ExpedientReportRow>> getExpedients(
            @RequestParam(name = "dateFrom") String dateFrom,
            @RequestParam(name = "dateTo") String dateTo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String owner,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        ReportFilterRequest filter = ReportFilterRequest.of(dateFrom, dateTo, status, type, area, owner, null, null, null, null);
        return ResponseEntity.ok(reportService.getExpedientsReport(filter, page, size));
    }

    @GetMapping("/audit")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Reporte de auditoría", description = "Requiere rango de fechas. Acciones y eventos por usuario.")
    public ResponseEntity<ReportPageResponse<AuditReportRow>> getAudit(
            @RequestParam(name = "dateFrom") String dateFrom,
            @RequestParam(name = "dateTo") String dateTo,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String owner,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        ReportFilterRequest filter = ReportFilterRequest.of(dateFrom, dateTo, null, null, null, owner, action, module, result, null);
        return ResponseEntity.ok(reportService.getAuditReport(filter, page, size));
    }

    @GetMapping("/{reportType}/export/csv")
    @PreAuthorize("hasAuthority('report:read')")
    @Operation(summary = "Exportar reporte en CSV", description = "Generación directa de archivo CSV desde el servidor.")
    public ResponseEntity<byte[]> exportCsv(
            @PathVariable String reportType,
            @RequestParam(name = "dateFrom") String dateFrom,
            @RequestParam(name = "dateTo") String dateTo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String search
    ) {
        ReportFilterRequest filter = ReportFilterRequest.of(dateFrom, dateTo, status, type, area, owner, action, module, result, search);
        byte[] csv = reportService.exportCsv(reportType, filter);

        String filename = "reporte-" + reportType.toLowerCase() + "-" + LocalDate.now().format(DateTimeFormatter.ISO_DATE) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, HttpHeaders.CONTENT_DISPOSITION)
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv);
    }
}
