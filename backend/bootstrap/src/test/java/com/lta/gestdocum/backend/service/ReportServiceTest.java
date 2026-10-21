package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentReportRow;
import com.lta.gestdocum.backend.dto.ReportFilterRequest;
import com.lta.gestdocum.backend.dto.ReportPageResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private NamedParameterJdbcTemplate db;

    @Mock
    private AuthenticatedUserContext context;

    @InjectMocks
    private ReportService reportService;

    private UUID tenantId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        when(context.requireTenantId()).thenReturn(tenantId);
    }

    @Test
    @DisplayName("getDocumentsReport establece contexto de BD y filtra por tenant y rango de fechas")
    void getDocumentsReport_filtersByTenantAndDates() {
        ReportFilterRequest filter = ReportFilterRequest.of(
                "2026-09-01", "2026-09-30", null, null, null, null, null, null, null, null
        );

        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class)))
                .thenReturn(1L);

        DocumentReportRow row = new DocumentReportRow(
                UUID.randomUUID(), "Acta", "ACT-01", "Acta", "Dirección", "Laura", "2026-09-10", "APPROVED"
        );
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of(row));

        ReportPageResponse<DocumentReportRow> response = reportService.getDocumentsReport(filter, 1, 10);

        assertNotNull(response);
        assertEquals(1, response.totalElements());
        assertEquals(1, response.content().size());
        assertEquals("ACT-01", response.content().get(0).code());

        verify(context).establishDatabaseContext();
        verify(context).requireTenantId();
    }

    @Test
    @DisplayName("exportCsv genera bytes CSV con BOM UTF-8 y cabeceras de columnas")
    void exportCsv_generatesCsvWithBomAndHeaders() {
        ReportFilterRequest filter = ReportFilterRequest.of(
                "2026-09-01", "2026-09-30", null, null, null, null, null, null, null, null
        );

        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class)))
                .thenReturn(0L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        byte[] csv = reportService.exportCsv("documents", filter);

        assertNotNull(csv);
        assertTrue(csv.length > 3);
        // Verificar BOM UTF-8 (0xEF, 0xBB, 0xBF)
        assertEquals((byte) 0xEF, csv[0]);
        assertEquals((byte) 0xBB, csv[1]);
        assertEquals((byte) 0xBF, csv[2]);

        String content = new String(csv, StandardCharsets.UTF_8);
        assertTrue(content.contains("Documento,Código,Tipo,Área,Responsable,Fecha,Estado"));
    }
}
