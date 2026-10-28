package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ReportPageResponse;
import com.lta.gestdocum.backend.service.PlatformAnalyticsService;
import com.lta.gestdocum.backend.service.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/** Panel y reportes transversales del administrador de la plataforma SaaS. */
@RestController
@RequestMapping("/api/v1/platform")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformAnalyticsController {
    private final PlatformAnalyticsService analytics;

    public PlatformAnalyticsController(PlatformAnalyticsService analytics) { this.analytics = analytics; }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        return analytics.dashboard();
    }

    @GetMapping("/reports/{type}")
    public ReportPageResponse<Map<String, Object>> report(@PathVariable String type,
                                                          @RequestParam String dateFrom, @RequestParam String dateTo,
                                                          @RequestParam(required = false) String status,
                                                          @RequestParam(name = "type", required = false) String kind,
                                                          @RequestParam(required = false) String search,
                                                          @RequestParam(defaultValue = "1") int page,
                                                          @RequestParam(defaultValue = "10") int size) {
        return analytics.report(type, filters(dateFrom, dateTo, status, kind, search), page, size);
    }

    @GetMapping("/reports/{type}/export/csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable String type,
                                            @RequestParam String dateFrom, @RequestParam String dateTo,
                                            @RequestParam(required = false) String status,
                                            @RequestParam(name = "type", required = false) String kind,
                                            @RequestParam(required = false) String search) {
        ReportService.CsvExport csv = analytics.exportCsv(type, filters(dateFrom, dateTo, status, kind, search));
        String filename = "plataforma-" + type.replaceAll("[^a-z]", "") + "-" + LocalDate.now() + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(ReportController.TOTAL_ROWS_HEADER, String.valueOf(csv.totalRows()))
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, HttpHeaders.CONTENT_DISPOSITION + ", " + ReportController.TOTAL_ROWS_HEADER)
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv.content());
    }

    @ExceptionHandler(ReportService.ExportTooLargeException.class)
    public ResponseEntity<Map<String, Object>> handleExportTooLarge(ReportService.ExportTooLargeException exception) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", 413);
        body.put("error", "Payload Too Large");
        body.put("message", exception.getMessage());
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(body);
    }

    private static Map<String, String> filters(String dateFrom, String dateTo, String status, String kind, String search) {
        Map<String, String> filters = new HashMap<>();
        filters.put("dateFrom", dateFrom);
        filters.put("dateTo", dateTo);
        filters.put("status", status);
        filters.put("type", kind);
        filters.put("search", search);
        return filters;
    }
}
