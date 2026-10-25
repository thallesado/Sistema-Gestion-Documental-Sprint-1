package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse;
import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.DateTimeException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;

    public AnalyticsService(NamedParameterJdbcTemplate db, AuthenticatedUserContext context) {
        this.db = db;
        this.context = context;
    }

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

    public void validateDateRange(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        if (dateFrom == null || dateTo == null) {
            throw new IllegalArgumentException("El rango de fechas (dateFrom y dateTo) es obligatorio para la analítica.");
        }
        if (dateFrom.isAfter(dateTo)) {
            throw new IllegalArgumentException("La fecha de inicio (dateFrom) no puede ser posterior a la fecha final (dateTo).");
        }
    }

    public AnalyticsDashboardResponse getDashboard(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        validateDateRange(dateFrom, dateTo);
        UUID tenantId = prepareTenantScope();

        AnalyticsSummary summary = getSummary(tenantId, dateFrom, dateTo);
        List<MonthlyPoint> monthly = getMonthlyTrend(tenantId, dateFrom, dateTo);
        List<AreaDistribution> areas = getAreaDistribution(tenantId, dateFrom, dateTo);
        List<WorkflowCycleTime> cycleTimes = getWorkflowCycleTimes(tenantId, dateFrom, dateTo);
        List<TopUserActivity> topUsers = getTopUsers(tenantId, dateFrom, dateTo, 5);
        OcrAnalytics ocr = getOcrPerformance(tenantId, dateFrom, dateTo);

        return new AnalyticsDashboardResponse(
                dateFrom,
                dateTo,
                summary,
                monthly,
                areas,
                cycleTimes,
                topUsers,
                ocr
        );
    }

    public AnalyticsSummary getSummary(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        validateDateRange(dateFrom, dateTo);
        UUID tenantId = prepareTenantScope();
        return getSummary(tenantId, dateFrom, dateTo);
    }

    private AnalyticsSummary getSummary(UUID tenantId, OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(dateFrom.toInstant()))
                .addValue("dateTo", Timestamp.from(dateTo.toInstant()));

        // Documentos y aprobación
        String docSql = """
                SELECT count(*) AS total_docs,
                       count(CASE WHEN d.status = 'APPROVED' THEN 1 END) AS approved_docs
                FROM documents d
                WHERE d.tenant_id = :tenantId
                  AND d.deleted_at IS NULL
                  AND d.created_at >= :dateFrom
                  AND d.created_at <= :dateTo
                """;
        Map<String, Object> docStats = db.queryForMap(docSql, params);
        long totalDocs = ((Number) docStats.get("total_docs")).longValue();
        long approvedDocs = ((Number) docStats.get("approved_docs")).longValue();
        double approvalRate = totalDocs > 0 ? Math.round((approvedDocs * 100.0 / totalDocs) * 10.0) / 10.0 : 0.0;

        // Workflows y promedio de horas
        String wfSql = """
                SELECT count(*) AS total_wf,
                       round(coalesce(avg((extract(epoch from w.completed_at) - extract(epoch from coalesce(w.started_at, w.created_at))) / 3600.0), 0)::numeric, 1) AS avg_hours
                FROM workflows w
                WHERE w.tenant_id = :tenantId
                  AND w.created_at >= :dateFrom
                  AND w.created_at <= :dateTo
                  AND (w.status = 'COMPLETED' OR w.completed_at IS NOT NULL)
                """;
        Map<String, Object> wfStats = db.queryForMap(wfSql, params);
        long totalWf = ((Number) wfStats.get("total_wf")).longValue();
        double avgHours = ((Number) wfStats.get("avg_hours")).doubleValue();

        // Usuarios activos
        String userSql = """
                SELECT count(DISTINCT user_id) AS active_users
                FROM audit_events
                WHERE tenant_id = :tenantId
                  AND occurred_at >= :dateFrom
                  AND occurred_at <= :dateTo
                  AND user_id IS NOT NULL
                """;
        Long activeUsers = db.queryForObject(userSql, params, Long.class);

        // OCR Performance
        OcrAnalytics ocr = getOcrPerformance(tenantId, dateFrom, dateTo);

        return new AnalyticsSummary(
                totalDocs,
                approvalRate,
                totalWf,
                avgHours,
                activeUsers != null ? activeUsers : 0,
                ocr.totalProcessed(),
                ocr.acceptanceRate(),
                ocr.averageConfidence()
        );
    }

    public List<MonthlyPoint> getMonthlyTrend(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        validateDateRange(dateFrom, dateTo);
        UUID tenantId = prepareTenantScope();
        return getMonthlyTrend(tenantId, dateFrom, dateTo);
    }

    private List<MonthlyPoint> getMonthlyTrend(UUID tenantId, OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(dateFrom.toInstant()))
                .addValue("dateTo", Timestamp.from(dateTo.toInstant()))
                .addValue("tz", zoneFor(tenantId).getId());

        String docTrendSql = """
                SELECT to_char(d.created_at AT TIME ZONE :tz, 'YYYY-MM') AS month_label,
                       count(*) AS created_count,
                       count(CASE WHEN d.status = 'APPROVED' THEN 1 END) AS approved_count
                FROM documents d
                WHERE d.tenant_id = :tenantId
                  AND d.deleted_at IS NULL
                  AND d.created_at >= :dateFrom
                  AND d.created_at <= :dateTo
                GROUP BY month_label
                ORDER BY month_label ASC
                """;

        Map<String, long[]> docMonths = new LinkedHashMap<>();
        db.query(docTrendSql, params, rs -> {
            String month = rs.getString("month_label");
            long created = rs.getLong("created_count");
            long approved = rs.getLong("approved_count");
            docMonths.put(month, new long[]{created, approved, 0});
        });

        String wfTrendSql = """
                SELECT to_char(w.completed_at AT TIME ZONE :tz, 'YYYY-MM') AS month_label,
                       count(*) AS completed_count
                FROM workflows w
                WHERE w.tenant_id = :tenantId
                  AND w.status = 'COMPLETED'
                  AND w.completed_at IS NOT NULL
                  AND w.completed_at >= :dateFrom
                  AND w.completed_at <= :dateTo
                GROUP BY month_label
                ORDER BY month_label ASC
                """;

        db.query(wfTrendSql, params, rs -> {
            String month = rs.getString("month_label");
            long completed = rs.getLong("completed_count");
            if (docMonths.containsKey(month)) {
                docMonths.get(month)[2] = completed;
            } else {
                docMonths.put(month, new long[]{0, 0, completed});
            }
        });

        List<MonthlyPoint> result = new ArrayList<>();
        docMonths.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> result.add(new MonthlyPoint(
                        e.getKey(),
                        e.getValue()[0],
                        e.getValue()[1],
                        e.getValue()[2]
                )));

        return result;
    }

    public List<AreaDistribution> getAreaDistribution(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        validateDateRange(dateFrom, dateTo);
        UUID tenantId = prepareTenantScope();
        return getAreaDistribution(tenantId, dateFrom, dateTo);
    }

    private List<AreaDistribution> getAreaDistribution(UUID tenantId, OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(dateFrom.toInstant()))
                .addValue("dateTo", Timestamp.from(dateTo.toInstant()));

        String sql = """
                SELECT coalesce(dep.name, 'Sin departamento') AS area_name,
                       count(DISTINCT d.id) AS doc_count
                FROM documents d
                LEFT JOIN tenant_departments dep ON dep.id = d.department_id AND dep.tenant_id = d.tenant_id
                WHERE d.tenant_id = :tenantId
                  AND d.deleted_at IS NULL
                  AND d.created_at >= :dateFrom
                  AND d.created_at <= :dateTo
                GROUP BY coalesce(dep.name, 'Sin departamento')
                ORDER BY doc_count DESC
                """;

        Map<String, long[]> areas = new LinkedHashMap<>();
        db.query(sql, params, rs -> {
            areas.put(rs.getString("area_name"), new long[]{rs.getLong("doc_count"), 0});
        });

        String workflowSql = """
                SELECT coalesce(dep.name, 'Sin departamento') AS area_name,
                       count(DISTINCT w.id) AS workflow_count
                FROM workflows w
                JOIN workflow_documents wd ON wd.workflow_id = w.id AND wd.tenant_id = w.tenant_id
                JOIN documents d ON d.id = wd.document_id AND d.tenant_id = wd.tenant_id
                LEFT JOIN tenant_departments dep ON dep.id = d.department_id AND dep.tenant_id = d.tenant_id
                WHERE w.tenant_id = :tenantId
                  AND d.deleted_at IS NULL
                  AND w.created_at >= :dateFrom
                  AND w.created_at <= :dateTo
                GROUP BY coalesce(dep.name, 'Sin departamento')
                """;
        db.query(workflowSql, params, rs -> {
            areas.computeIfAbsent(rs.getString("area_name"), key -> new long[]{0, 0})[1] = rs.getLong("workflow_count");
        });

        List<AreaDistribution> result = new ArrayList<>();
        areas.entrySet().stream()
                .sorted((a, b) -> a.getValue()[0] != b.getValue()[0]
                        ? Long.compare(b.getValue()[0], a.getValue()[0])
                        : Long.compare(b.getValue()[1], a.getValue()[1]))
                .forEach(e -> result.add(new AreaDistribution(e.getKey(), e.getValue()[0], e.getValue()[1])));
        return result;
    }

    public List<WorkflowCycleTime> getWorkflowCycleTimes(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        validateDateRange(dateFrom, dateTo);
        UUID tenantId = prepareTenantScope();
        return getWorkflowCycleTimes(tenantId, dateFrom, dateTo);
    }

    private List<WorkflowCycleTime> getWorkflowCycleTimes(UUID tenantId, OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(dateFrom.toInstant()))
                .addValue("dateTo", Timestamp.from(dateTo.toInstant()));

        String sql = """
                SELECT coalesce(wt.name, 'Estándar') AS template_name,
                       count(*) AS completed_count,
                       round(coalesce(avg((extract(epoch from w.completed_at) - extract(epoch from coalesce(w.started_at, w.created_at))) / 3600.0), 0)::numeric, 1) AS avg_hours,
                       round(coalesce(min((extract(epoch from w.completed_at) - extract(epoch from coalesce(w.started_at, w.created_at))) / 3600.0), 0)::numeric, 1) AS min_hours,
                       round(coalesce(max((extract(epoch from w.completed_at) - extract(epoch from coalesce(w.started_at, w.created_at))) / 3600.0), 0)::numeric, 1) AS max_hours,
                       count(CASE WHEN w.completed_at > w.due_at THEN 1 END) AS overdue_count
                FROM workflows w
                LEFT JOIN workflow_templates wt ON wt.id = w.workflow_template_id AND wt.tenant_id = w.tenant_id
                WHERE w.tenant_id = :tenantId
                  AND w.status = 'COMPLETED'
                  AND w.completed_at IS NOT NULL
                  AND w.created_at >= :dateFrom
                  AND w.created_at <= :dateTo
                GROUP BY coalesce(wt.name, 'Estándar')
                ORDER BY completed_count DESC
                """;

        return db.query(sql, params, (rs, rowNum) -> new WorkflowCycleTime(
                rs.getString("template_name"),
                rs.getLong("completed_count"),
                rs.getDouble("avg_hours"),
                rs.getDouble("min_hours"),
                rs.getDouble("max_hours"),
                rs.getLong("overdue_count")
        ));
    }

    public List<TopUserActivity> getTopUsers(OffsetDateTime dateFrom, OffsetDateTime dateTo, int limit) {
        validateDateRange(dateFrom, dateTo);
        UUID tenantId = prepareTenantScope();
        return getTopUsers(tenantId, dateFrom, dateTo, limit);
    }

    private List<TopUserActivity> getTopUsers(UUID tenantId, OffsetDateTime dateFrom, OffsetDateTime dateTo, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(dateFrom.toInstant()))
                .addValue("dateTo", Timestamp.from(dateTo.toInstant()))
                .addValue("limit", safeLimit);

        String sql = """
                SELECT u.id,
                       trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS full_name,
                       u.username,
                       coalesce((SELECT min(r.name) FROM user_roles ur
                                 JOIN roles r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
                                 WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id), 'Usuario') AS role_name,
                       coalesce(dep.name, 'General') AS area_name,
                       (SELECT count(*) FROM audit_events a
                         WHERE a.user_id = u.id AND a.tenant_id = u.tenant_id
                           AND a.occurred_at >= :dateFrom AND a.occurred_at <= :dateTo) AS audit_actions,
                       (SELECT count(*) FROM documents d
                         WHERE d.author_id = u.id AND d.tenant_id = u.tenant_id AND d.deleted_at IS NULL
                           AND d.created_at >= :dateFrom AND d.created_at <= :dateTo) AS documents_created
                FROM users u
                LEFT JOIN tenant_departments dep ON dep.id = u.department_id AND dep.tenant_id = u.tenant_id
                WHERE u.tenant_id = :tenantId
                  AND EXISTS (SELECT 1 FROM audit_events a
                              WHERE a.user_id = u.id AND a.tenant_id = u.tenant_id
                                AND a.occurred_at >= :dateFrom AND a.occurred_at <= :dateTo)
                ORDER BY audit_actions DESC, u.id
                LIMIT :limit
                """;

        return db.query(sql, params, (rs, rowNum) -> {
            String name = rs.getString("full_name");
            if (name == null || name.isBlank()) {
                name = rs.getString("username");
            }
            return new TopUserActivity(
                    name.trim(),
                    rs.getString("role_name"),
                    rs.getString("area_name"),
                    rs.getLong("audit_actions"),
                    rs.getLong("documents_created")
            );
        });
    }

    public OcrAnalytics getOcrPerformance(OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        validateDateRange(dateFrom, dateTo);
        UUID tenantId = prepareTenantScope();
        return getOcrPerformance(tenantId, dateFrom, dateTo);
    }

    private OcrAnalytics getOcrPerformance(UUID tenantId, OffsetDateTime dateFrom, OffsetDateTime dateTo) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tenantId", tenantId)
                .addValue("dateFrom", Timestamp.from(dateFrom.toInstant()))
                .addValue("dateTo", Timestamp.from(dateTo.toInstant()));

        String sql = """
                SELECT count(*) AS total_jobs,
                       count(CASE WHEN j.status IN ('VALIDATED', 'INDEXED') THEN 1 END) AS validated_count,
                       count(CASE WHEN j.status = 'REJECTED' THEN 1 END) AS rejected_count,
                       round(coalesce(avg(j.confidence_score), 0)::numeric, 2) AS avg_confidence,
                       round(coalesce(avg(j.processing_ms) / 1000.0, 0)::numeric, 1) AS avg_sec
                FROM ocr_jobs j
                WHERE j.tenant_id = :tenantId
                  AND j.created_at >= :dateFrom
                  AND j.created_at <= :dateTo
                """;

        Map<String, Object> map = db.queryForMap(sql, params);
        long total = ((Number) map.get("total_jobs")).longValue();
        long validated = ((Number) map.get("validated_count")).longValue();
        long rejected = ((Number) map.get("rejected_count")).longValue();
        double avgConf = ((Number) map.get("avg_confidence")).doubleValue();
        double avgSec = ((Number) map.get("avg_sec")).doubleValue();

        long reviewed = validated + rejected;
        double acceptanceRate = reviewed > 0 ? Math.round((validated * 100.0 / reviewed) * 10.0) / 10.0 : 0.0;

        return new OcrAnalytics(
                total,
                validated,
                rejected,
                acceptanceRate,
                avgConf,
                avgSec
        );
    }
}
