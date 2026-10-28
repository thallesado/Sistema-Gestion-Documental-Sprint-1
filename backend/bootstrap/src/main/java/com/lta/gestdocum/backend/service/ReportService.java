package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;

@Service
@Transactional(readOnly = true)
public class ReportService {

    /** Tope de filas de una exportación CSV; por encima se pide acotar los filtros (HTTP 413). */
    public static final int MAX_EXPORT_ROWS = 100_000;
    static final int EXPORT_BATCH_SIZE = 1000;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;
    private final ComponentPermissionService componentPermissions;

    /** Sobrescribible en pruebas del mismo paquete. */
    int maxExportRows = MAX_EXPORT_ROWS;

    public ReportService(NamedParameterJdbcTemplate db, AuthenticatedUserContext context,
                         ComponentPermissionService componentPermissions) {
        this.db = db;
        this.context = context;
        this.componentPermissions = componentPermissions;
    }

    /** La exportación supera {@link #MAX_EXPORT_ROWS}; el controlador la traduce a HTTP 413. */
    public static class ExportTooLargeException extends RuntimeException {
        private final long totalRows;
        private final int maxRows;

        public ExportTooLargeException(long totalRows, int maxRows) {
            super("La exportación tiene " + totalRows + " filas y el máximo permitido es " + maxRows
                    + ". Acote los filtros (rango de fechas, estado, área) e inténtelo de nuevo.");
            this.totalRows = totalRows;
            this.maxRows = maxRows;
        }

        public long totalRows() {
            return totalRows;
        }

        public int maxRows() {
            return maxRows;
        }
    }

    /** Archivo CSV y el total de filas que contiene. */
    public record CsvExport(byte[] content, long totalRows) {}

    private record Query(String countSql, String selectSql, MapSqlParameterSource params) {}

    private record Def<T>(Query query, RowMapper<T> mapper, String header, Function<T, List<Object>> cells) {}

    private UUID prepareTenantScope() {
        context.establishDatabaseContext();
        return context.requireTenantId();
    }

    /** Zona horaria configurada del tenant; UTC si no se puede determinar. */
    public ZoneId tenantZone() {
        return zoneFor(prepareTenantScope());
    }

    private ZoneId zoneFor(UUID tenantId) {
        List<String> values = db.queryForList("SELECT timezone FROM tenants WHERE id = :tenantId",
                new MapSqlParameterSource("tenantId", tenantId), String.class);
        if (values != null && !values.isEmpty() && values.get(0) != null && !values.get(0).isBlank()) {
            try {
                return ZoneId.of(values.get(0).trim());
            } catch (DateTimeException ignored) {
                // zona inválida almacenada: se usa UTC
            }
        }
        return ZoneOffset.UTC;
    }

    private MapSqlParameterSource baseParams(UUID tenantId, ReportFilterRequest filter) {
        return new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(filter.dateFrom().toInstant()))
                .addValue("dateTo", Timestamp.from(filter.dateTo().toInstant()));
    }

    private static String fmt(Timestamp ts, ZoneId zone, DateTimeFormatter formatter, String empty) {
        return ts != null ? ts.toInstant().atZone(zone).format(formatter) : empty;
    }

    private static void requireVisibleFilter(ComponentFormAccess access, Object value, String... components) {
        if (value == null) return;
        for (String component : components) {
            if (!access.visible(component)) {
                throw new AccessDeniedException("Tu perfil no puede filtrar por un campo que no tiene visible ("
                        + access.form().key() + "." + component + ")");
            }
        }
    }

    // ==========================================
    // Paginación y ejecución
    // ==========================================
    private <T> ReportPageResponse<T> paged(Def<T> def, int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 200));
        long total = count(def.query());
        List<T> rows = fetch(def, safeSize, (safePage - 1) * safeSize);
        return ReportPageResponse.of(rows, total, safePage, safeSize);
    }

    private long count(Query query) {
        Long total = db.queryForObject(query.countSql(), query.params(), Long.class);
        return total != null ? total : 0;
    }

    private <T> List<T> fetch(Def<T> def, int limit, int offset) {
        MapSqlParameterSource params = def.query().params();
        params.addValue("limit", limit).addValue("offset", offset);
        return db.query(def.query().selectSql() + " LIMIT :limit OFFSET :offset", params, def.mapper());
    }

    // ==========================================
    // 1. REPORTE DE DOCUMENTOS
    // ==========================================
    public ReportPageResponse<DocumentReportRow> getDocumentsReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        return paged(documentsDef(filter, tenantId, zoneFor(tenantId)), page, size);
    }

    private Def<DocumentReportRow> documentsDef(ReportFilterRequest filter, UUID tenantId, ZoneId zone) {
        ComponentFormAccess access = componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM);
        requireVisibleFilter(access, filter.search(), "nombre", "codigo");
        requireVisibleFilter(access, filter.area(), "departamento");
        requireVisibleFilter(access, filter.owner(), "responsable");

        MapSqlParameterSource params = baseParams(tenantId, filter);
        StringBuilder where = new StringBuilder("""
                WHERE d.tenant_id = :tenantId
                  AND d.deleted_at IS NULL
                  AND d.created_at >= :dateFrom
                  AND d.created_at <= :dateTo
                """);
        applyDocumentFilters(filter, params, where);

        String from = """
                FROM documents d
                LEFT JOIN document_types dt ON dt.id = d.document_type_id AND dt.tenant_id = d.tenant_id
                LEFT JOIN tenant_departments dep ON dep.id = d.department_id AND dep.tenant_id = d.tenant_id
                LEFT JOIN users u ON u.id = coalesce(d.responsible_id, d.author_id) AND u.tenant_id = d.tenant_id
                """;
        String select = """
                SELECT d.id, d.name AS document, d.code,
                       coalesce(dt.name, 'Sin tipo') AS type,
                       coalesce(dep.name, 'General') AS area,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS owner,
                       d.created_at AS date,
                       cast(d.status AS text) AS status
                """ + from + where + " ORDER BY d.created_at DESC, d.id";

        RowMapper<DocumentReportRow> mapper = (rs, rowNum) -> {
            String owner = rs.getString("owner");
            if (owner == null || owner.isBlank()) {
                owner = "Sin asignar";
            }
            return new DocumentReportRow(
                    (UUID) rs.getObject("id"),
                    access.reveal("nombre", rs.getString("document")),
                    access.reveal("codigo", rs.getString("code")),
                    rs.getString("type"),
                    access.reveal("departamento", rs.getString("area")),
                    access.reveal("responsable", owner.trim()),
                    fmt(rs.getTimestamp("date"), zone, DATE_FMT, ""),
                    rs.getString("status")
            );
        };
        return new Def<>(new Query("SELECT count(*) " + from + where, select, params), mapper,
                "Documento,Código,Tipo,Área,Responsable,Fecha,Estado",
                r -> List.of(nz(r.document()), nz(r.code()), nz(r.type()), nz(r.area()), nz(r.owner()), nz(r.date()), nz(r.status())));
    }

    private void applyDocumentFilters(ReportFilterRequest filter, MapSqlParameterSource params, StringBuilder where) {
        if (filter.status() != null) {
            where.append(" AND d.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.type() != null) {
            where.append(" AND dt.name ILIKE :type");
            params.addValue("type", "%" + filter.type() + "%");
        }
        if (filter.area() != null) {
            where.append(" AND dep.name ILIKE :area");
            params.addValue("area", "%" + filter.area() + "%");
        }
        if (filter.owner() != null) {
            where.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }
        if (filter.search() != null) {
            where.append(" AND (d.name ILIKE :search OR d.code ILIKE :search)");
            params.addValue("search", "%" + filter.search() + "%");
        }
    }

    // ==========================================
    // 2. REPORTE DE USUARIOS
    // ==========================================
    public ReportPageResponse<UserReportRow> getUsersReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        return paged(usersDef(filter, tenantId, zoneFor(tenantId)), page, size);
    }

    private Def<UserReportRow> usersDef(ReportFilterRequest filter, UUID tenantId, ZoneId zone) {
        ComponentFormAccess access = componentPermissions.current(ComponentFormCatalog.USER_FORM);
        requireVisibleFilter(access, filter.status(), "estado");
        requireVisibleFilter(access, filter.owner(), "nombre", "apellido", "correo");

        MapSqlParameterSource params = baseParams(tenantId, filter);
        StringBuilder where = new StringBuilder("""
                WHERE u.tenant_id = :tenantId
                  AND u.deleted_at IS NULL
                  AND u.created_at <= :dateTo
                """);
        if (filter.status() != null) {
            where.append(" AND u.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.area() != null) {
            where.append(" AND dep.name ILIKE :area");
            params.addValue("area", "%" + filter.area() + "%");
        }
        if (filter.owner() != null) {
            where.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner OR u.email ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String countSql = "SELECT count(DISTINCT u.id) FROM users u " +
                "LEFT JOIN tenant_departments dep ON dep.id = u.department_id AND dep.tenant_id = u.tenant_id " +
                where;

        String select = """
                SELECT u.id, u.first_name, u.last_name, u.email,
                       coalesce(r.name, 'Usuario') AS role,
                       coalesce(dep.name, 'General') AS area,
                       coalesce(aud.actions, 0) AS actions,
                       aud.last_access,
                       cast(u.status AS text) AS status
                FROM users u
                LEFT JOIN tenant_departments dep ON dep.id = u.department_id AND dep.tenant_id = u.tenant_id
                LEFT JOIN (
                    SELECT ur.user_id, min(ro.name) AS name
                    FROM user_roles ur
                    JOIN roles ro ON ro.id = ur.role_id AND ro.tenant_id = ur.tenant_id
                    WHERE ur.tenant_id = :tenantId
                    GROUP BY ur.user_id
                ) r ON r.user_id = u.id
                LEFT JOIN LATERAL (
                    SELECT count(*) AS actions, max(a.occurred_at) AS last_access
                    FROM audit_events a
                    WHERE a.user_id = u.id
                      AND a.tenant_id = u.tenant_id
                      AND a.occurred_at >= :dateFrom
                      AND a.occurred_at <= :dateTo
                ) aud ON true
                """ + where + " ORDER BY coalesce(aud.actions, 0) DESC, u.created_at DESC, u.id";

        RowMapper<UserReportRow> mapper = (rs, rowNum) -> {
            String first = access.visible("nombre") ? nz(rs.getString("first_name")) : "";
            String last = access.visible("apellido") ? nz(rs.getString("last_name")) : "";
            String userName = (first + " " + last).trim();
            if (userName.isBlank()) {
                userName = access.visible("correo") ? rs.getString("email") : null;
            }
            return new UserReportRow(
                    (UUID) rs.getObject("id"),
                    userName != null ? userName.trim() : null,
                    access.reveal("grupos", rs.getString("role")),
                    rs.getString("area"),
                    fmt(rs.getTimestamp("last_access"), zone, DATETIME_FMT, "Sin actividad"),
                    rs.getLong("actions"),
                    access.reveal("estado", rs.getString("status"))
            );
        };
        return new Def<>(new Query(countSql, select, params), mapper,
                "Usuario,Rol,Área,Último acceso,Acciones operativas,Estado",
                r -> List.of(nz(r.user()), nz(r.role()), nz(r.area()), nz(r.lastAccess()), r.actions(), nz(r.status())));
    }

    // ==========================================
    // 3. REPORTE DE WORKFLOWS
    // ==========================================
    public ReportPageResponse<WorkflowReportRow> getWorkflowsReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        return paged(workflowsDef(filter, tenantId, zoneFor(tenantId)), page, size);
    }

    private Def<WorkflowReportRow> workflowsDef(ReportFilterRequest filter, UUID tenantId, ZoneId zone) {
        ComponentFormAccess access = componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM);

        MapSqlParameterSource params = baseParams(tenantId, filter);
        StringBuilder where = new StringBuilder("""
                WHERE w.tenant_id = :tenantId
                  AND w.created_at >= :dateFrom
                  AND w.created_at <= :dateTo
                """);
        if (filter.status() != null) {
            where.append(" AND w.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.type() != null) {
            where.append(" AND wt.name ILIKE :type");
            params.addValue("type", "%" + filter.type() + "%");
        }
        if (filter.owner() != null) {
            where.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String from = """
                FROM workflows w
                LEFT JOIN workflow_templates wt ON wt.id = w.workflow_template_id AND wt.tenant_id = w.tenant_id
                LEFT JOIN workflow_template_stages ws ON ws.id = w.current_stage_id AND ws.tenant_id = w.tenant_id
                LEFT JOIN users u ON u.id = w.creator_id AND u.tenant_id = w.tenant_id
                LEFT JOIN LATERAL (
                    SELECT d.code FROM workflow_documents wd
                    JOIN documents d ON d.id = wd.document_id AND d.tenant_id = wd.tenant_id
                    WHERE wd.workflow_id = w.id AND wd.tenant_id = w.tenant_id
                    ORDER BY wd.document_id
                    LIMIT 1
                ) doc ON true
                """;
        String select = """
                SELECT w.id, w.title AS workflow,
                       coalesce(doc.code, 'N/A') AS document,
                       coalesce(wt.name, 'Estándar') AS type,
                       coalesce(ws.name, 'Inicial') AS stage,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS owner,
                       w.started_at, w.created_at, w.due_at, w.completed_at,
                       cast(w.status AS text) AS status
                """ + from + where + " ORDER BY w.created_at DESC, w.id";

        RowMapper<WorkflowReportRow> mapper = (rs, rowNum) -> {
            Timestamp startTs = rs.getTimestamp("started_at");
            if (startTs == null) {
                startTs = rs.getTimestamp("created_at");
            }
            Timestamp dueTs = rs.getTimestamp("due_at");
            Timestamp compTs = rs.getTimestamp("completed_at");

            String elapsedStr;
            if (startTs != null) {
                long endMillis = (compTs != null ? compTs : new Timestamp(System.currentTimeMillis())).getTime();
                long diffHours = Math.max(0, (endMillis - startTs.getTime()) / (1000 * 60 * 60));
                if (diffHours >= 24) {
                    long days = diffHours / 24;
                    long remHours = diffHours % 24;
                    elapsedStr = remHours > 0 ? days + " d " + remHours + " h" : days + " d";
                } else {
                    elapsedStr = diffHours + " h";
                }
            } else {
                elapsedStr = "0 h";
            }

            String owner = rs.getString("owner");
            if (owner == null || owner.isBlank()) {
                owner = "Sistema";
            }
            return new WorkflowReportRow(
                    (UUID) rs.getObject("id"),
                    rs.getString("workflow"),
                    access.reveal("codigo", rs.getString("document")),
                    rs.getString("type"),
                    rs.getString("stage"),
                    owner.trim(),
                    fmt(startTs, zone, DATE_FMT, ""),
                    fmt(dueTs, zone, DATE_FMT, "Sin límite"),
                    elapsedStr,
                    rs.getString("status")
            );
        };
        return new Def<>(new Query("SELECT count(*) " + from.substring(0, from.indexOf("LEFT JOIN LATERAL")) + where,
                select, params), mapper,
                "Workflow,Documento,Tipo,Etapa,Responsable,Inicio,Límite,Transcurrido,Estado",
                r -> List.of(nz(r.workflow()), nz(r.document()), nz(r.type()), nz(r.stage()), nz(r.owner()),
                        nz(r.start()), nz(r.deadline()), nz(r.elapsed()), nz(r.status())));
    }

    // ==========================================
    // 4. REPORTE DE EXPEDIENTES
    // ==========================================
    public ReportPageResponse<ExpedientReportRow> getExpedientsReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        return paged(expedientsDef(filter, tenantId, zoneFor(tenantId)), page, size);
    }

    private Def<ExpedientReportRow> expedientsDef(ReportFilterRequest filter, UUID tenantId, ZoneId zone) {
        MapSqlParameterSource params = baseParams(tenantId, filter);
        StringBuilder where = new StringBuilder("""
                WHERE e.tenant_id = :tenantId
                  AND e.deleted_at IS NULL
                  AND e.created_at >= :dateFrom
                  AND e.created_at <= :dateTo
                """);
        if (filter.status() != null) {
            where.append(" AND e.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.type() != null) {
            where.append(" AND et.name ILIKE :type");
            params.addValue("type", "%" + filter.type() + "%");
        }
        if (filter.area() != null) {
            where.append(" AND dep.name ILIKE :area");
            params.addValue("area", "%" + filter.area() + "%");
        }
        if (filter.owner() != null) {
            where.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String from = """
                FROM expedients e
                LEFT JOIN expedient_types et ON et.id = e.expedient_type_id AND et.tenant_id = e.tenant_id
                LEFT JOIN tenant_departments dep ON dep.id = e.department_id AND dep.tenant_id = e.tenant_id
                LEFT JOIN users u ON u.id = e.responsible_id AND u.tenant_id = e.tenant_id
                """;
        String select = """
                SELECT e.id, e.name AS expedient, e.code,
                       coalesce(et.name, 'General') AS type,
                       coalesce(dep.name, 'General') AS area,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS owner,
                       e.created_at AS date,
                       cast(e.status AS text) AS status
                """ + from + where + " ORDER BY e.created_at DESC, e.id";

        RowMapper<ExpedientReportRow> mapper = (rs, rowNum) -> {
            String owner = rs.getString("owner");
            if (owner == null || owner.isBlank()) {
                owner = "Sin asignar";
            }
            return new ExpedientReportRow(
                    (UUID) rs.getObject("id"),
                    rs.getString("expedient"),
                    rs.getString("code"),
                    rs.getString("type"),
                    rs.getString("area"),
                    owner.trim(),
                    fmt(rs.getTimestamp("date"), zone, DATE_FMT, ""),
                    rs.getString("status")
            );
        };
        return new Def<>(new Query("SELECT count(*) " + from + where, select, params), mapper,
                "Expediente,Código,Tipo,Área,Responsable,Fecha,Estado",
                r -> List.of(nz(r.expedient()), nz(r.code()), nz(r.type()), nz(r.area()), nz(r.owner()), nz(r.date()), nz(r.status())));
    }

    // ==========================================
    // 5. REPORTE DE AUDITORÍA
    // ==========================================
    public ReportPageResponse<AuditReportRow> getAuditReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        return paged(auditDef(filter, tenantId, zoneFor(tenantId)), page, size);
    }

    private Def<AuditReportRow> auditDef(ReportFilterRequest filter, UUID tenantId, ZoneId zone) {
        MapSqlParameterSource params = baseParams(tenantId, filter);
        StringBuilder where = new StringBuilder("""
                WHERE a.tenant_id = :tenantId
                  AND a.occurred_at >= :dateFrom
                  AND a.occurred_at <= :dateTo
                """);
        if (filter.action() != null) {
            where.append(" AND a.action ILIKE :action");
            params.addValue("action", "%" + filter.action() + "%");
        }
        if (filter.module() != null) {
            where.append(" AND a.entity_type ILIKE :module");
            params.addValue("module", "%" + filter.module() + "%");
        }
        if (filter.result() != null) {
            where.append(" AND a.result = :result");
            params.addValue("result", filter.result());
        }
        if (filter.owner() != null) {
            where.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String countSql = "SELECT count(*) FROM audit_events a " +
                "LEFT JOIN users u ON u.id = a.user_id AND u.tenant_id = a.tenant_id " +
                where;
        String select = """
                SELECT a.id, a.occurred_at AS timestamp,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS user_name,
                       a.action, a.entity_type AS module,
                       coalesce(cast(a.entity_id AS text), 'N/A') AS resource,
                       coalesce(dep.name, 'General') AS area,
                       coalesce(cast(a.ip_address AS text), '127.0.0.1') AS ip,
                       a.result
                FROM audit_events a
                LEFT JOIN users u ON u.id = a.user_id AND u.tenant_id = a.tenant_id
                LEFT JOIN tenant_departments dep ON dep.id = u.department_id AND dep.tenant_id = u.tenant_id
                """ + where + " ORDER BY a.occurred_at DESC, a.id DESC";

        RowMapper<AuditReportRow> mapper = (rs, rowNum) -> {
            String userName = rs.getString("user_name");
            if (userName == null || userName.isBlank()) {
                userName = "Sistema";
            }
            return new AuditReportRow(
                    rs.getLong("id"),
                    fmt(rs.getTimestamp("timestamp"), zone, DATETIME_FMT, ""),
                    userName.trim(),
                    rs.getString("action"),
                    rs.getString("module"),
                    rs.getString("resource"),
                    rs.getString("area"),
                    rs.getString("ip"),
                    rs.getString("result")
            );
        };
        return new Def<>(new Query(countSql, select, params), mapper,
                "Timestamp,Usuario,Acción,Módulo,Recurso,Área,IP,Resultado",
                r -> List.of(nz(r.timestamp()), nz(r.user()), nz(r.action()), nz(r.module()), nz(r.resource()),
                        nz(r.area()), nz(r.ip()), nz(r.result())));
    }

    // ==========================================
    // 6. REPORTE DE OCR
    // ==========================================
    public ReportPageResponse<OcrReportRow> getOcrReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        return paged(ocrDef(filter, tenantId, zoneFor(tenantId)), page, size);
    }

    private Def<OcrReportRow> ocrDef(ReportFilterRequest filter, UUID tenantId, ZoneId zone) {
        ComponentFormAccess access = componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM);
        requireVisibleFilter(access, filter.search(), "nombre");

        MapSqlParameterSource params = baseParams(tenantId, filter);
        StringBuilder where = new StringBuilder("""
                WHERE o.tenant_id = :tenantId
                  AND o.created_at >= :dateFrom
                  AND o.created_at <= :dateTo
                """);
        if (filter.status() != null) {
            where.append(" AND o.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.owner() != null) {
            where.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }
        if (filter.search() != null) {
            where.append(" AND (o.original_file_path ILIKE :search OR d.name ILIKE :search)");
            params.addValue("search", "%" + filter.search() + "%");
        }

        String from = """
                FROM ocr_jobs o
                LEFT JOIN documents d ON d.id = o.document_id AND d.tenant_id = o.tenant_id
                LEFT JOIN users u ON u.id = o.uploaded_by AND u.tenant_id = o.tenant_id
                """;
        String select = """
                SELECT o.id, regexp_replace(o.original_file_path, '^.*/', '') AS file,
                       d.name AS document, o.file_type,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS uploader,
                       o.pages_total, o.confidence_score, o.created_at,
                       cast(o.status AS text) AS status
                """ + from + where + " ORDER BY o.created_at DESC, o.id";

        RowMapper<OcrReportRow> mapper = (rs, rowNum) -> {
            String uploader = rs.getString("uploader");
            if (uploader == null || uploader.isBlank()) {
                uploader = "Sistema";
            }
            int pages = rs.getInt("pages_total");
            Integer pagesValue = rs.wasNull() ? null : pages;
            double score = rs.getDouble("confidence_score");
            String confidence = rs.wasNull() ? null : String.format(Locale.ROOT, "%.1f%%", score * 100);
            String document = rs.getString("document");
            return new OcrReportRow(
                    (UUID) rs.getObject("id"),
                    rs.getString("file"),
                    access.reveal("nombre", document != null ? document : "Sin documento"),
                    rs.getString("file_type"),
                    uploader.trim(),
                    pagesValue,
                    confidence,
                    fmt(rs.getTimestamp("created_at"), zone, DATETIME_FMT, ""),
                    rs.getString("status")
            );
        };
        return new Def<>(new Query("SELECT count(*) " + from + where, select, params), mapper,
                "Archivo,Documento,Tipo de archivo,Cargado por,Páginas,Confianza,Fecha,Estado",
                r -> List.of(nz(r.file()), nz(r.document()), nz(r.fileType()), nz(r.uploadedBy()),
                        r.pages() != null ? r.pages() : "", nz(r.confidence()), nz(r.date()), nz(r.status())));
    }

    // ==========================================
    // 7. EXPORTACIÓN CSV EN EL SERVIDOR
    // ==========================================
    public byte[] exportCsv(String reportType, ReportFilterRequest filter) {
        return exportCsvFile(reportType, filter).content();
    }

    /** Exporta todas las filas filtradas (en lotes de {@value #EXPORT_BATCH_SIZE}) hasta {@link #MAX_EXPORT_ROWS}. */
    public CsvExport exportCsvFile(String reportType, ReportFilterRequest filter) {
        String type = reportType == null ? "" : reportType.toLowerCase();
        if (!List.of("documents", "users", "workflows", "expedients", "audit", "ocr").contains(type)) {
            throw new IllegalArgumentException("Tipo de reporte no soportado: " + reportType);
        }
        UUID tenantId = prepareTenantScope();
        ZoneId zone = zoneFor(tenantId);
        return switch (type) {
            case "documents" -> writeCsv(documentsDef(filter, tenantId, zone));
            case "users" -> writeCsv(usersDef(filter, tenantId, zone));
            case "workflows" -> writeCsv(workflowsDef(filter, tenantId, zone));
            case "expedients" -> writeCsv(expedientsDef(filter, tenantId, zone));
            case "audit" -> writeCsv(auditDef(filter, tenantId, zone));
            default -> writeCsv(ocrDef(filter, tenantId, zone));
        };
    }

    private <T> CsvExport writeCsv(Def<T> def) {
        long total = count(def.query());
        if (total > maxExportRows) {
            throw new ExportTooLargeException(total, maxExportRows);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(out, true, StandardCharsets.UTF_8)) {
            // BOM UTF-8 para apertura correcta en Microsoft Excel
            writer.write('﻿');
            writer.println(def.header());
            int offset = 0;
            do {
                List<T> rows = fetch(def, EXPORT_BATCH_SIZE, offset);
                for (T row : rows) {
                    writer.print(csvLine(def.cells().apply(row)));
                    writer.print(System.lineSeparator());
                }
                if (rows.size() < EXPORT_BATCH_SIZE) break;
                offset += EXPORT_BATCH_SIZE;
            } while (offset < total);
        }
        return new CsvExport(out.toByteArray(), total);
    }

    private static String csvLine(List<Object> cells) {
        StringJoiner joiner = new StringJoiner(",");
        for (Object cell : cells) {
            joiner.add(cell instanceof Number ? String.valueOf(cell) : "\"" + escape(String.valueOf(cell)) + "\"");
        }
        return joiner.toString();
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }

    /** Duplica comillas y neutraliza inyección de fórmulas (=, +, -, @) anteponiendo una comilla simple. */
    static String escape(String val) {
        if (val == null) return "";
        String safe = val.replace("\"", "\"\"");
        if (!safe.isEmpty() && "=+-@".indexOf(safe.charAt(0)) >= 0) {
            return "'" + safe;
        }
        return safe;
    }
}
