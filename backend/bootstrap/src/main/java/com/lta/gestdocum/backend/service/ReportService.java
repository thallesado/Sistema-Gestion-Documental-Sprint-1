package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ReportService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;

    public ReportService(NamedParameterJdbcTemplate db, AuthenticatedUserContext context) {
        this.db = db;
        this.context = context;
    }

    private UUID prepareTenantScope() {
        context.establishDatabaseContext();
        return context.requireTenantId();
    }

    // ==========================================
    // 1. REPORTE DE DOCUMENTOS
    // ==========================================
    public ReportPageResponse<DocumentReportRow> getDocumentsReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 200));
        int offset = (safePage - 1) * safeSize;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(filter.dateFrom().toInstant()))
                .addValue("dateTo", Timestamp.from(filter.dateTo().toInstant()))
                .addValue("limit", safeSize)
                .addValue("offset", offset);

        StringBuilder whereClause = new StringBuilder("""
                WHERE d.tenant_id = :tenantId
                  AND d.deleted_at IS NULL
                  AND d.created_at >= :dateFrom
                  AND d.created_at <= :dateTo
                """);

        applyDocumentFilters(filter, params, whereClause);

        String countSql = "SELECT count(*) FROM documents d " +
                "LEFT JOIN document_types dt ON dt.id = d.document_type_id AND dt.tenant_id = d.tenant_id " +
                "LEFT JOIN tenant_departments dep ON dep.id = d.department_id AND dep.tenant_id = d.tenant_id " +
                "LEFT JOIN users u ON u.id = coalesce(d.responsible_id, d.author_id) AND u.tenant_id = d.tenant_id " +
                whereClause;

        Long total = db.queryForObject(countSql, params, Long.class);
        long totalElements = total != null ? total : 0;

        String querySql = """
                SELECT d.id, d.name AS document, d.code,
                       coalesce(dt.name, 'Sin tipo') AS type,
                       coalesce(dep.name, 'General') AS area,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS owner,
                       d.created_at AS date,
                       cast(d.status AS text) AS status
                FROM documents d
                LEFT JOIN document_types dt ON dt.id = d.document_type_id AND dt.tenant_id = d.tenant_id
                LEFT JOIN tenant_departments dep ON dep.id = d.department_id AND dep.tenant_id = d.tenant_id
                LEFT JOIN users u ON u.id = coalesce(d.responsible_id, d.author_id) AND u.tenant_id = d.tenant_id
                """ + whereClause + " ORDER BY d.created_at DESC LIMIT :limit OFFSET :offset";

        List<DocumentReportRow> rows = db.query(querySql, params, (rs, rowNum) -> {
            Timestamp ts = rs.getTimestamp("date");
            String dateStr = ts != null ? ts.toLocalDateTime().format(DATE_FMT) : "";
            String owner = rs.getString("owner");
            if (owner == null || owner.isBlank()) {
                owner = "Sin asignar";
            }
            return new DocumentReportRow(
                    (UUID) rs.getObject("id"),
                    rs.getString("document"),
                    rs.getString("code"),
                    rs.getString("type"),
                    rs.getString("area"),
                    owner.trim(),
                    dateStr,
                    rs.getString("status")
            );
        });

        return ReportPageResponse.of(rows, totalElements, safePage, safeSize);
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
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 200));
        int offset = (safePage - 1) * safeSize;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(filter.dateFrom().toInstant()))
                .addValue("dateTo", Timestamp.from(filter.dateTo().toInstant()))
                .addValue("limit", safeSize)
                .addValue("offset", offset);

        StringBuilder whereClause = new StringBuilder("""
                WHERE u.tenant_id = :tenantId
                  AND u.deleted_at IS NULL
                  AND u.created_at <= :dateTo
                """);

        if (filter.status() != null) {
            whereClause.append(" AND u.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.area() != null) {
            whereClause.append(" AND dep.name ILIKE :area");
            params.addValue("area", "%" + filter.area() + "%");
        }
        if (filter.owner() != null) {
            whereClause.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner OR u.email ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String countSql = "SELECT count(DISTINCT u.id) FROM users u " +
                "LEFT JOIN tenant_departments dep ON dep.id = u.department_id AND dep.tenant_id = u.tenant_id " +
                whereClause;

        Long total = db.queryForObject(countSql, params, Long.class);
        long totalElements = total != null ? total : 0;

        String querySql = """
                SELECT u.id,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS user_name,
                       u.email,
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
                """ + whereClause + " ORDER BY coalesce(aud.actions, 0) DESC, u.created_at DESC LIMIT :limit OFFSET :offset";

        List<UserReportRow> rows = db.query(querySql, params, (rs, rowNum) -> {
            Timestamp ts = rs.getTimestamp("last_access");
            String lastAccessStr = ts != null ? ts.toLocalDateTime().format(DATETIME_FMT) : "Sin actividad";
            String userName = rs.getString("user_name");
            if (userName == null || userName.isBlank()) {
                userName = rs.getString("email");
            }
            return new UserReportRow(
                    (UUID) rs.getObject("id"),
                    userName.trim(),
                    rs.getString("role"),
                    rs.getString("area"),
                    lastAccessStr,
                    rs.getLong("actions"),
                    rs.getString("status")
            );
        });

        return ReportPageResponse.of(rows, totalElements, safePage, safeSize);
    }

    // ==========================================
    // 3. REPORTE DE WORKFLOWS
    // ==========================================
    public ReportPageResponse<WorkflowReportRow> getWorkflowsReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 200));
        int offset = (safePage - 1) * safeSize;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(filter.dateFrom().toInstant()))
                .addValue("dateTo", Timestamp.from(filter.dateTo().toInstant()))
                .addValue("limit", safeSize)
                .addValue("offset", offset);

        StringBuilder whereClause = new StringBuilder("""
                WHERE w.tenant_id = :tenantId
                  AND w.created_at >= :dateFrom
                  AND w.created_at <= :dateTo
                """);

        if (filter.status() != null) {
            whereClause.append(" AND w.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.type() != null) {
            whereClause.append(" AND wt.name ILIKE :type");
            params.addValue("type", "%" + filter.type() + "%");
        }
        if (filter.owner() != null) {
            whereClause.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String countSql = "SELECT count(*) FROM workflows w " +
                "LEFT JOIN workflow_templates wt ON wt.id = w.workflow_template_id AND wt.tenant_id = w.tenant_id " +
                "LEFT JOIN users u ON u.id = w.creator_id AND u.tenant_id = w.tenant_id " +
                whereClause;

        Long total = db.queryForObject(countSql, params, Long.class);
        long totalElements = total != null ? total : 0;

        String querySql = """
                SELECT w.id, w.title AS workflow,
                       coalesce(doc.code, 'N/A') AS document,
                       coalesce(wt.name, 'Estándar') AS type,
                       coalesce(ws.name, 'Inicial') AS stage,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS owner,
                       w.started_at, w.created_at, w.due_at, w.completed_at,
                       cast(w.status AS text) AS status
                FROM workflows w
                LEFT JOIN workflow_templates wt ON wt.id = w.workflow_template_id AND wt.tenant_id = w.tenant_id
                LEFT JOIN workflow_template_stages ws ON ws.id = w.current_stage_id AND ws.tenant_id = w.tenant_id
                LEFT JOIN users u ON u.id = w.creator_id AND u.tenant_id = w.tenant_id
                LEFT JOIN LATERAL (
                    SELECT d.code FROM workflow_documents wd
                    JOIN documents d ON d.id = wd.document_id AND d.tenant_id = wd.tenant_id
                    WHERE wd.workflow_id = w.id AND wd.tenant_id = w.tenant_id
                    LIMIT 1
                ) doc ON true
                """ + whereClause + " ORDER BY w.created_at DESC LIMIT :limit OFFSET :offset";

        List<WorkflowReportRow> rows = db.query(querySql, params, (rs, rowNum) -> {
            Timestamp startTs = rs.getTimestamp("started_at");
            if (startTs == null) {
                startTs = rs.getTimestamp("created_at");
            }
            Timestamp dueTs = rs.getTimestamp("due_at");
            Timestamp compTs = rs.getTimestamp("completed_at");

            String startStr = startTs != null ? startTs.toLocalDateTime().format(DATE_FMT) : "";
            String dueStr = dueTs != null ? dueTs.toLocalDateTime().format(DATE_FMT) : "Sin límite";

            // Cálculo tiempo transcurrido
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
                    rs.getString("document"),
                    rs.getString("type"),
                    rs.getString("stage"),
                    owner.trim(),
                    startStr,
                    dueStr,
                    elapsedStr,
                    rs.getString("status")
            );
        });

        return ReportPageResponse.of(rows, totalElements, safePage, safeSize);
    }

    // ==========================================
    // 4. REPORTE DE EXPEDIENTES
    // ==========================================
    public ReportPageResponse<ExpedientReportRow> getExpedientsReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 200));
        int offset = (safePage - 1) * safeSize;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(filter.dateFrom().toInstant()))
                .addValue("dateTo", Timestamp.from(filter.dateTo().toInstant()))
                .addValue("limit", safeSize)
                .addValue("offset", offset);

        StringBuilder whereClause = new StringBuilder("""
                WHERE e.tenant_id = :tenantId
                  AND e.deleted_at IS NULL
                  AND e.created_at >= :dateFrom
                  AND e.created_at <= :dateTo
                """);

        if (filter.status() != null) {
            whereClause.append(" AND e.status::text ILIKE :status");
            params.addValue("status", filter.status());
        }
        if (filter.type() != null) {
            whereClause.append(" AND et.name ILIKE :type");
            params.addValue("type", "%" + filter.type() + "%");
        }
        if (filter.area() != null) {
            whereClause.append(" AND dep.name ILIKE :area");
            params.addValue("area", "%" + filter.area() + "%");
        }
        if (filter.owner() != null) {
            whereClause.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String countSql = "SELECT count(*) FROM expedients e " +
                "LEFT JOIN expedient_types et ON et.id = e.expedient_type_id AND et.tenant_id = e.tenant_id " +
                "LEFT JOIN tenant_departments dep ON dep.id = e.department_id AND dep.tenant_id = e.tenant_id " +
                "LEFT JOIN users u ON u.id = e.responsible_id AND u.tenant_id = e.tenant_id " +
                whereClause;

        Long total = db.queryForObject(countSql, params, Long.class);
        long totalElements = total != null ? total : 0;

        String querySql = """
                SELECT e.id, e.name AS expedient, e.code,
                       coalesce(et.name, 'General') AS type,
                       coalesce(dep.name, 'General') AS area,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS owner,
                       e.created_at AS date,
                       cast(e.status AS text) AS status
                FROM expedients e
                LEFT JOIN expedient_types et ON et.id = e.expedient_type_id AND et.tenant_id = e.tenant_id
                LEFT JOIN tenant_departments dep ON dep.id = e.department_id AND dep.tenant_id = e.tenant_id
                LEFT JOIN users u ON u.id = e.responsible_id AND u.tenant_id = e.tenant_id
                """ + whereClause + " ORDER BY e.created_at DESC LIMIT :limit OFFSET :offset";

        List<ExpedientReportRow> rows = db.query(querySql, params, (rs, rowNum) -> {
            Timestamp ts = rs.getTimestamp("date");
            String dateStr = ts != null ? ts.toLocalDateTime().format(DATE_FMT) : "";
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
                    dateStr,
                    rs.getString("status")
            );
        });

        return ReportPageResponse.of(rows, totalElements, safePage, safeSize);
    }

    // ==========================================
    // 5. REPORTE DE AUDITORÍA
    // ==========================================
    public ReportPageResponse<AuditReportRow> getAuditReport(ReportFilterRequest filter, int page, int size) {
        UUID tenantId = prepareTenantScope();
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(size, 200));
        int offset = (safePage - 1) * safeSize;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(filter.dateFrom().toInstant()))
                .addValue("dateTo", Timestamp.from(filter.dateTo().toInstant()))
                .addValue("limit", safeSize)
                .addValue("offset", offset);

        StringBuilder whereClause = new StringBuilder("""
                WHERE a.tenant_id = :tenantId
                  AND a.occurred_at >= :dateFrom
                  AND a.occurred_at <= :dateTo
                """);

        if (filter.action() != null) {
            whereClause.append(" AND a.action ILIKE :action");
            params.addValue("action", "%" + filter.action() + "%");
        }
        if (filter.module() != null) {
            whereClause.append(" AND a.entity_type ILIKE :module");
            params.addValue("module", "%" + filter.module() + "%");
        }
        if (filter.result() != null) {
            whereClause.append(" AND a.result = :result");
            params.addValue("result", filter.result());
        }
        if (filter.owner() != null) {
            whereClause.append(" AND (u.first_name ILIKE :owner OR u.last_name ILIKE :owner OR u.username ILIKE :owner)");
            params.addValue("owner", "%" + filter.owner() + "%");
        }

        String countSql = "SELECT count(*) FROM audit_events a " +
                "LEFT JOIN users u ON u.id = a.user_id AND u.tenant_id = a.tenant_id " +
                whereClause;

        Long total = db.queryForObject(countSql, params, Long.class);
        long totalElements = total != null ? total : 0;

        String querySql = """
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
                """ + whereClause + " ORDER BY a.occurred_at DESC LIMIT :limit OFFSET :offset";

        List<AuditReportRow> rows = db.query(querySql, params, (rs, rowNum) -> {
            Timestamp ts = rs.getTimestamp("timestamp");
            String tsStr = ts != null ? ts.toLocalDateTime().format(DATETIME_FMT) : "";
            String userName = rs.getString("user_name");
            if (userName == null || userName.isBlank()) {
                userName = "Sistema";
            }
            return new AuditReportRow(
                    rs.getLong("id"),
                    tsStr,
                    userName.trim(),
                    rs.getString("action"),
                    rs.getString("module"),
                    rs.getString("resource"),
                    rs.getString("area"),
                    rs.getString("ip"),
                    rs.getString("result")
            );
        });

        return ReportPageResponse.of(rows, totalElements, safePage, safeSize);
    }

    // ==========================================
    // 6. EXPORTACIÓN CSV EN EL SERVIDOR
    // ==========================================
    public byte[] exportCsv(String reportType, ReportFilterRequest filter) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(out, true, StandardCharsets.UTF_8)) {
            // Escribir BOM UTF-8 para apertura correcta en Microsoft Excel
            writer.write('\uFEFF');

            switch (reportType.toLowerCase()) {
                case "documents" -> {
                    writer.println("Documento,Código,Tipo,Área,Responsable,Fecha,Estado");
                    ReportPageResponse<DocumentReportRow> rep = getDocumentsReport(filter, 1, 10000);
                    for (DocumentReportRow r : rep.content()) {
                        writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"%n",
                                escape(r.document()), escape(r.code()), escape(r.type()),
                                escape(r.area()), escape(r.owner()), escape(r.date()), escape(r.status()));
                    }
                }
                case "users" -> {
                    writer.println("Usuario,Rol,Área,Último acceso,Acciones operativas,Estado");
                    ReportPageResponse<UserReportRow> rep = getUsersReport(filter, 1, 10000);
                    for (UserReportRow r : rep.content()) {
                        writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",%d,\"%s\"%n",
                                escape(r.user()), escape(r.role()), escape(r.area()),
                                escape(r.lastAccess()), r.actions(), escape(r.status()));
                    }
                }
                case "workflows" -> {
                    writer.println("Workflow,Documento,Tipo,Etapa,Responsable,Inicio,Límite,Transcurrido,Estado");
                    ReportPageResponse<WorkflowReportRow> rep = getWorkflowsReport(filter, 1, 10000);
                    for (WorkflowReportRow r : rep.content()) {
                        writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"%n",
                                escape(r.workflow()), escape(r.document()), escape(r.type()), escape(r.stage()),
                                escape(r.owner()), escape(r.start()), escape(r.deadline()), escape(r.elapsed()), escape(r.status()));
                    }
                }
                case "expedients" -> {
                    writer.println("Expediente,Código,Tipo,Área,Responsable,Fecha,Estado");
                    ReportPageResponse<ExpedientReportRow> rep = getExpedientsReport(filter, 1, 10000);
                    for (ExpedientReportRow r : rep.content()) {
                        writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"%n",
                                escape(r.expedient()), escape(r.code()), escape(r.type()),
                                escape(r.area()), escape(r.owner()), escape(r.date()), escape(r.status()));
                    }
                }
                case "audit" -> {
                    writer.println("Timestamp,Usuario,Acción,Módulo,Recurso,Área,IP,Resultado");
                    ReportPageResponse<AuditReportRow> rep = getAuditReport(filter, 1, 10000);
                    for (AuditReportRow r : rep.content()) {
                        writer.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"%n",
                                escape(r.timestamp()), escape(r.user()), escape(r.action()), escape(r.module()),
                                escape(r.resource()), escape(r.area()), escape(r.ip()), escape(r.result()));
                    }
                }
                default -> throw new IllegalArgumentException("Tipo de reporte no soportado: " + reportType);
            }
        }
        return out.toByteArray();
    }

    private String escape(String val) {
        if (val == null) return "";
        return val.replace("\"", "\"\"");
    }
}
