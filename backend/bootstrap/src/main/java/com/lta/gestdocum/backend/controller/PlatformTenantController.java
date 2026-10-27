package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PlatformTenantActionRequests;
import com.lta.gestdocum.backend.dto.PlatformTenantOverviewResponse;
import com.lta.gestdocum.backend.dto.ReportPageResponse;
import com.lta.gestdocum.backend.service.PlatformAuditService;
import com.lta.gestdocum.backend.service.PlatformTenantService;
import com.lta.gestdocum.backend.service.ReportService;
import jakarta.validation.Valid;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ficha de organización y auditoría de plataforma; solo cuentas de administración global. */
@RestController
@RequestMapping("/api/v1/platform")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformTenantController {
    private final PlatformTenantService tenants;
    private final PlatformAuditService audit;

    public PlatformTenantController(PlatformTenantService tenants, PlatformAuditService audit) {
        this.tenants = tenants;
        this.audit = audit;
    }

    @GetMapping("/tenants/{id}/overview")
    public PlatformTenantOverviewResponse overview(@PathVariable UUID id) {
        return tenants.overview(id);
    }

    @PostMapping("/tenants/{id}/status")
    public PlatformTenantOverviewResponse status(@PathVariable UUID id,
                                                 @Valid @RequestBody PlatformTenantActionRequests.StatusChange request) {
        return tenants.changeStatus(id, request.status(), request.reason());
    }

    @PostMapping("/tenants/{id}/trial-extension")
    public PlatformTenantOverviewResponse extendTrial(@PathVariable UUID id,
                                                      @Valid @RequestBody PlatformTenantActionRequests.TrialExtension request) {
        return tenants.extendTrial(id, request.days(), request.reason());
    }

    @PostMapping("/tenants/{id}/plan")
    public PlatformTenantOverviewResponse changePlan(@PathVariable UUID id,
                                                     @Valid @RequestBody PlatformTenantActionRequests.PlanChange request) {
        return tenants.changePlan(id, request.planCode(), request.acceptOverLimit(), request.reason());
    }

    @GetMapping("/audit")
    public ReportPageResponse<Map<String, Object>> audit(@RequestParam(required = false) String dateFrom,
                                                         @RequestParam(required = false) String dateTo,
                                                         @RequestParam(required = false) String action,
                                                         @RequestParam(required = false) String tenantId,
                                                         @RequestParam(required = false) String actor,
                                                         @RequestParam(defaultValue = "1") int page,
                                                         @RequestParam(defaultValue = "20") int size) {
        return audit.search(filters(dateFrom, dateTo, action, tenantId, actor), page, size);
    }

    @GetMapping("/audit/actions")
    public List<String> auditActions() {
        audit.requirePlatformAccount();
        return PlatformAuditService.ACTIONS;
    }

    @GetMapping("/audit/export/csv")
    public ResponseEntity<byte[]> exportAudit(@RequestParam(required = false) String dateFrom,
                                              @RequestParam(required = false) String dateTo,
                                              @RequestParam(required = false) String action,
                                              @RequestParam(required = false) String tenantId,
                                              @RequestParam(required = false) String actor) {
        ReportService.CsvExport csv = audit.exportCsv(filters(dateFrom, dateTo, action, tenantId, actor));
        String filename = "plataforma-auditoria-" + LocalDate.now() + ".csv";
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

    private static Map<String, String> filters(String dateFrom, String dateTo, String action, String tenantId, String actor) {
        Map<String, String> filters = new HashMap<>();
        filters.put("dateFrom", dateFrom);
        filters.put("dateTo", dateTo);
        filters.put("action", action);
        filters.put("tenantId", tenantId);
        filters.put("actor", actor);
        return filters;
    }
}
