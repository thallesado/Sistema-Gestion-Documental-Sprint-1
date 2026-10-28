package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.service.ReportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportControllerTest {

    @Mock
    private ReportService reportService;

    @InjectMocks
    private ReportController controller;

    @Test
    @DisplayName("Petición sin fecha inicial o final lanza IllegalArgumentException (rechazo 400)")
    void getDocuments_missingDates_throwsException() {
        assertThrows(IllegalArgumentException.class, () ->
                controller.getDocuments(null, "2026-09-30", null, null, null, null, null, 1, 10));

        assertThrows(IllegalArgumentException.class, () ->
                controller.getDocuments("2026-09-01", "", null, null, null, null, null, 1, 10));

        assertThrows(IllegalArgumentException.class, () ->
                controller.getDocuments("   ", "2026-09-30", null, null, null, null, null, 1, 10));
    }

    @Test
    @DisplayName("Petición con dateFrom posterior a dateTo lanza IllegalArgumentException")
    void getDocuments_dateFromAfterDateTo_throwsException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                controller.getDocuments("2026-10-01", "2026-09-01", null, null, null, null, null, 1, 10));

        assertTrue(ex.getMessage().contains("no puede ser posterior"));
    }

    @Test
    @DisplayName("Petición válida de documentos devuelve paginación desde el servicio")
    void getDocuments_validRequest_returnsData() {
        DocumentReportRow row = new DocumentReportRow(
                UUID.randomUUID(), "Política de Seguridad", "DOC-001", "Política",
                "Dirección", "María González", "2026-09-15", "APPROVED"
        );
        ReportPageResponse<DocumentReportRow> page = ReportPageResponse.of(List.of(row), 1, 1, 10);

        when(reportService.getDocumentsReport(any(ReportFilterRequest.class), eq(1), eq(10)))
                .thenReturn(page);

        ResponseEntity<ReportPageResponse<DocumentReportRow>> response = controller.getDocuments(
                "2026-09-01", "2026-09-30", "APPROVED", null, null, null, null, 1, 10
        );

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().totalElements());
        assertEquals("DOC-001", response.getBody().content().get(0).code());
        verify(reportService).getDocumentsReport(any(ReportFilterRequest.class), eq(1), eq(10));
    }

    @Test
    @DisplayName("Exportación a CSV devuelve cabeceras correctas y archivo generado")
    void exportCsv_returnsCsvFile() {
        byte[] mockBytes = "Documento,Código\nDoc1,C1".getBytes();
        when(reportService.exportCsvFile(eq("documents"), any(ReportFilterRequest.class)))
                .thenReturn(new ReportService.CsvExport(mockBytes, 2));

        ResponseEntity<byte[]> response = controller.exportCsv(
                "documents", "2026-09-01", "2026-09-30",
                null, null, null, null, null, null, null, null
        );

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getContentType().toString().contains("text/csv"));
        assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("attachment; filename=\"reporte-documents-"));
        assertArrayEquals(mockBytes, response.getBody());
        assertEquals("2", response.getHeaders().getFirst("X-Report-Total-Rows"));
    }

    @Test
    @DisplayName("Una exportación demasiado grande responde 413 con mensaje y total de filas")
    void exportTooLarge_maps413() {
        ResponseEntity<java.util.Map<String, Object>> response =
                controller.handleExportTooLarge(new ReportService.ExportTooLargeException(150_000, 100_000));

        assertEquals(413, response.getStatusCode().value());
        assertEquals("150000", response.getHeaders().getFirst("X-Report-Total-Rows"));
        assertTrue(response.getBody().get("message").toString().contains("Acote los filtros"));
    }

    @Test
    @DisplayName("Las fechas sin hora se interpretan en la zona horaria del tenant")
    void getDocuments_parsesDatesInTenantZone() {
        when(reportService.tenantZone()).thenReturn(java.time.ZoneId.of("America/La_Paz"));
        when(reportService.getDocumentsReport(any(ReportFilterRequest.class), eq(1), eq(10)))
                .thenReturn(ReportPageResponse.of(List.of(), 0, 1, 10));

        controller.getDocuments("2026-09-01", "2026-09-30", null, null, null, null, null, 1, 10);

        org.mockito.ArgumentCaptor<ReportFilterRequest> captor = org.mockito.ArgumentCaptor.forClass(ReportFilterRequest.class);
        verify(reportService).getDocumentsReport(captor.capture(), eq(1), eq(10));
        assertEquals(java.time.Instant.parse("2026-09-01T04:00:00Z"), captor.getValue().dateFrom().toInstant());
    }

    @Test
    @DisplayName("El reporte de OCR valida el rango de fechas y delega al servicio")
    void getOcr_delegatesToService() {
        when(reportService.getOcrReport(any(ReportFilterRequest.class), eq(1), eq(10)))
                .thenReturn(ReportPageResponse.of(List.of(), 0, 1, 10));

        assertEquals(200, controller.getOcr("2026-09-01", "2026-09-30", null, null, null, 1, 10).getStatusCode().value());
        assertThrows(IllegalArgumentException.class, () -> controller.getOcr(null, "2026-09-30", null, null, null, 1, 10));
    }
}
