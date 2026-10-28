package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentReportRow;
import com.lta.gestdocum.backend.dto.ReportFilterRequest;
import com.lta.gestdocum.backend.dto.ReportPageResponse;
import com.lta.gestdocum.backend.dto.UserReportRow;
import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository;
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
import org.springframework.security.access.AccessDeniedException;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
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

    @Mock
    private ComponentPermissionService componentPermissions;

    @InjectMocks
    private ReportService reportService;

    private UUID tenantId;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        lenient().when(context.requireTenantId()).thenReturn(tenantId);
        lenient().when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM))
                .thenReturn(ComponentFormAccess.unrestricted(ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM)));
        lenient().when(componentPermissions.current(ComponentFormCatalog.USER_FORM))
                .thenReturn(ComponentFormAccess.unrestricted(ComponentFormCatalog.require(ComponentFormCatalog.USER_FORM)));
    }

    private static ReportFilterRequest filter() {
        return ReportFilterRequest.of("2026-09-01", "2026-09-30", null, null, null, null, null, null, null, null);
    }

    private static ComponentFormAccess hidden(String formKey, String... components) {
        List<ComponentPermissionRepository.Row> rows = new ArrayList<>();
        for (String component : components) {
            rows.add(new ComponentPermissionRepository.Row(1L, component, ComponentState.HIDDEN));
        }
        return ComponentFormAccess.resolve(ComponentFormCatalog.require(formKey), List.of(1L), rows);
    }

    @Test
    @DisplayName("getDocumentsReport establece contexto de BD y filtra por tenant y rango de fechas")
    void getDocumentsReport_filtersByTenantAndDates() {
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class)))
                .thenReturn(1L);

        DocumentReportRow row = new DocumentReportRow(
                UUID.randomUUID(), "Acta", "ACT-01", "Acta", "Dirección", "Laura", "2026-09-10", "APPROVED"
        );
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of(row));

        ReportPageResponse<DocumentReportRow> response = reportService.getDocumentsReport(filter(), 1, 10);

        assertNotNull(response);
        assertEquals(1, response.totalElements());
        assertEquals(1, response.content().size());
        assertEquals("ACT-01", response.content().get(0).code());

        verify(context).establishDatabaseContext();
        verify(context).requireTenantId();
    }

    @Test
    @DisplayName("Los reportes paginados siguen limitando el tamaño de página a 200 y ordenan con desempate por id")
    void pagedReport_capsSizeAndOrdersByIdTiebreak() {
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(0L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            SqlParameterSource params = inv.getArgument(1);
            assertTrue(sql.contains("ORDER BY d.created_at DESC, d.id LIMIT :limit OFFSET :offset"), sql);
            assertEquals(200, params.getValue("limit"));
            return List.of();
        });

        ReportPageResponse<DocumentReportRow> response = reportService.getDocumentsReport(filter(), 1, 10000);

        assertEquals(200, response.size());
    }

    @Test
    @DisplayName("exportCsv genera bytes CSV con BOM UTF-8 y cabeceras de columnas")
    void exportCsv_generatesCsvWithBomAndHeaders() {
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class)))
                .thenReturn(0L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenReturn(List.of());

        byte[] csv = reportService.exportCsv("documents", filter());

        assertNotNull(csv);
        assertTrue(csv.length > 3);
        assertEquals((byte) 0xEF, csv[0]);
        assertEquals((byte) 0xBB, csv[1]);
        assertEquals((byte) 0xBF, csv[2]);

        String content = new String(csv, StandardCharsets.UTF_8);
        assertTrue(content.contains("Documento,Código,Tipo,Área,Responsable,Fecha,Estado"));
    }

    @Test
    @DisplayName("exportCsv recorre todas las filas en lotes de 1000, no solo las primeras 200")
    void exportCsv_pagesThroughEveryRow() {
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(2500L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenAnswer(inv -> {
            SqlParameterSource params = inv.getArgument(1);
            int offset = (Integer) params.getValue("offset");
            assertEquals(1000, params.getValue("limit"));
            int count = Math.min(1000, 2500 - offset);
            List<DocumentReportRow> rows = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                rows.add(new DocumentReportRow(UUID.randomUUID(), "Doc " + (offset + i), "C-" + (offset + i),
                        "Tipo", "Area", "Owner", "2026-09-10", "APPROVED"));
            }
            return rows;
        });

        ReportService.CsvExport export = reportService.exportCsvFile("documents", filter());

        String[] lines = new String(export.content(), StandardCharsets.UTF_8).split("\\R");
        assertEquals(2501, lines.length);
        assertEquals(2500, export.totalRows());
        assertTrue(lines[2500].contains("Doc 2499"));
        verify(db, times(3)).query(anyString(), any(SqlParameterSource.class), any(RowMapper.class));
    }

    @Test
    @DisplayName("exportCsv por encima del máximo lanza ExportTooLargeException sin leer filas")
    void exportCsv_aboveMax_throwsTooLarge() {
        reportService.maxExportRows = 5;
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(6L);

        ReportService.ExportTooLargeException ex = assertThrows(ReportService.ExportTooLargeException.class,
                () -> reportService.exportCsvFile("documents", filter()));

        assertEquals(6, ex.totalRows());
        assertEquals(5, ex.maxRows());
        assertTrue(ex.getMessage().contains("Acote los filtros"));
        verify(db, never()).query(anyString(), any(SqlParameterSource.class), any(RowMapper.class));
        assertEquals(100_000, ReportService.MAX_EXPORT_ROWS);
    }

    @Test
    @DisplayName("exportCsv antepone una comilla simple a celdas que empiezan por = + - @")
    void exportCsv_neutralisesFormulaCells() {
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(1L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn(List.of(
                new DocumentReportRow(UUID.randomUUID(), "=HYPERLINK(\"x\")", "+1", "-2", "@SUM", "Ok \"q\"", "2026-09-10", "APPROVED")));

        String csv = new String(reportService.exportCsv("documents", filter()), StandardCharsets.UTF_8);

        assertTrue(csv.contains("\"'=HYPERLINK(\"\"x\"\")\",\"'+1\",\"'-2\",\"'@SUM\",\"Ok \"\"q\"\"\""), csv);
    }

    @Test
    @DisplayName("exportCsv con tipo desconocido sigue rechazando con IllegalArgumentException")
    void exportCsv_unknownType_throws() {
        assertThrows(IllegalArgumentException.class, () -> reportService.exportCsv("nope", filter()));
    }

    @Test
    @DisplayName("tenantZone lee tenants.timezone con queryForList y cae a UTC si no hay valor")
    void tenantZone_readsTenantTimezoneOrUtc() {
        when(db.queryForList(anyString(), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of("America/La_Paz"))
                .thenReturn(List.of());

        assertEquals(ZoneId.of("America/La_Paz"), reportService.tenantZone());
        assertEquals(java.time.ZoneOffset.UTC, reportService.tenantZone());
    }

    @Test
    @DisplayName("Las fechas del reporte se formatean en la zona horaria del tenant")
    void documentsReport_formatsDatesInTenantZone() throws Exception {
        when(db.queryForList(anyString(), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of("America/La_Paz"));
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(1L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenAnswer(inv -> {
            RowMapper<?> mapper = inv.getArgument(2);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getObject("id")).thenReturn(UUID.randomUUID());
            when(rs.getString("document")).thenReturn("Acta");
            when(rs.getString("code")).thenReturn("A-1");
            when(rs.getString("type")).thenReturn("Tipo");
            when(rs.getString("area")).thenReturn("Area");
            when(rs.getString("owner")).thenReturn("Laura");
            when(rs.getString("status")).thenReturn("APPROVED");
            // 02:00 UTC del día 11 es el día 10 a las 22:00 en La Paz (UTC-4)
            when(rs.getTimestamp("date")).thenReturn(Timestamp.from(Instant.parse("2026-09-11T02:00:00Z")));
            return List.of(mapper.mapRow(rs, 0));
        });

        DocumentReportRow row = (DocumentReportRow) reportService.getDocumentsReport(filter(), 1, 10).content().get(0);

        assertEquals("2026-09-10", row.date());
    }

    @Test
    @DisplayName("Componentes ocultos de documentos se devuelven nulos y vacíos en el CSV")
    void documentsReport_masksHiddenComponents() throws Exception {
        when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM))
                .thenReturn(hidden(ComponentFormCatalog.DOCUMENT_FORM, "nombre", "codigo", "departamento", "responsable"));
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(1L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenAnswer(inv -> {
            RowMapper<?> mapper = inv.getArgument(2);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getObject("id")).thenReturn(UUID.randomUUID());
            when(rs.getString("document")).thenReturn("Secreto");
            when(rs.getString("code")).thenReturn("S-1");
            when(rs.getString("type")).thenReturn("Tipo");
            when(rs.getString("area")).thenReturn("Area");
            when(rs.getString("owner")).thenReturn("Laura");
            when(rs.getString("status")).thenReturn("APPROVED");
            return List.of(mapper.mapRow(rs, 0));
        });

        DocumentReportRow row = reportService.getDocumentsReport(filter(), 1, 10).content().get(0);
        assertNull(row.document());
        assertNull(row.code());
        assertNull(row.area());
        assertNull(row.owner());
        assertEquals("Tipo", row.type());

        String csv = new String(reportService.exportCsv("documents", filter()), StandardCharsets.UTF_8);
        assertTrue(csv.contains("\"\",\"\",\"Tipo\",\"\",\"\",\"\",\"APPROVED\""), csv);
        assertFalse(csv.contains("Secreto"));
    }

    @Test
    @DisplayName("Filtrar por un componente oculto lanza AccessDeniedException")
    void documentsReport_filterByHiddenComponent_denied() {
        when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM))
                .thenReturn(hidden(ComponentFormCatalog.DOCUMENT_FORM, "codigo"));
        ReportFilterRequest searching = ReportFilterRequest.of(
                "2026-09-01", "2026-09-30", null, null, null, null, null, null, null, "ACT");

        assertThrows(AccessDeniedException.class, () -> reportService.getDocumentsReport(searching, 1, 10));
    }

    @Test
    @DisplayName("El reporte de usuarios oculta nombre, rol y estado según los componentes")
    void usersReport_masksHiddenComponents() throws Exception {
        when(componentPermissions.current(ComponentFormCatalog.USER_FORM))
                .thenReturn(hidden(ComponentFormCatalog.USER_FORM, "nombre", "apellido", "correo", "grupos", "estado"));
        when(db.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class))).thenReturn(1L);
        when(db.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenAnswer(inv -> {
            RowMapper<?> mapper = inv.getArgument(2);
            ResultSet rs = mock(ResultSet.class);
            when(rs.getObject("id")).thenReturn(UUID.randomUUID());
            lenient().when(rs.getString("first_name")).thenReturn("Laura");
            lenient().when(rs.getString("last_name")).thenReturn("Pérez");
            lenient().when(rs.getString("email")).thenReturn("laura@acme.com");
            when(rs.getString("role")).thenReturn("Admin");
            when(rs.getString("area")).thenReturn("General");
            when(rs.getString("status")).thenReturn("ACTIVE");
            when(rs.getLong("actions")).thenReturn(7L);
            return List.of(mapper.mapRow(rs, 0));
        });

        UserReportRow row = reportService.getUsersReport(filter(), 1, 10).content().get(0);

        assertNull(row.user());
        assertNull(row.role());
        assertNull(row.status());
        assertEquals(7L, row.actions());
        assertEquals("Sin actividad", row.lastAccess());
    }
}
