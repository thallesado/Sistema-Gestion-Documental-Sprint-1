package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.util.List;
import java.util.UUID;

/** Structured, minimal technical events retained in the control database for platform operators. */
@Service
public class PlatformTechnicalLogService {
    public record Event(long id, java.time.OffsetDateTime occurredAt, String level, UUID tenantId,
                        UUID actorId, String category, String summary, String requestMethod,
                        String requestPath, Integer httpStatus, String exceptionType) {}

    private final JdbcTemplate control;

    public PlatformTechnicalLogService(@Qualifier("controlDataSource") ObjectProvider<DataSource> controlDataSource,
                                       DataSource defaultDataSource) {
        this.control = new JdbcTemplate(controlDataSource.getIfAvailable(() -> defaultDataSource));
    }

    /** Persists only allowlisted, sanitized metadata. It never stores request bodies or exception messages. */
    public void record(AuthenticatedUser actor, String category, String summary, String method,
                       String path, Integer status, Throwable failure) {
        try {
            String level = (status != null && status >= 500) || failure != null ? "ERROR" : "WARN";
            control.queryForObject("SELECT app.record_platform_technical_log(?,?,?,?,?,?,?,?,?)",
                    Boolean.class, level, actor == null ? null : actor.tenantId(), actor == null ? null : actor.userId(),
                    safe(category, 80), safe(summary, 240), safe(method, 10), sanitizePath(path), status,
                    failure == null ? null : failure.getClass().getSimpleName());
        } catch (RuntimeException ignored) {
            // Logging failure must not recursively create entries or mask the request result.
        }
    }

    public Page<Event> list(String level, UUID tenantId, int requestedPage, int requestedSize) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 100));
        List<Event> rows = control.query("""
                SELECT id,occurred_at,level,tenant_id,actor_id,category,summary,request_method,request_path,
                       http_status,exception_type,total_count
                FROM app.list_platform_technical_logs(?,?,?,?)
                """, (rs, n) -> new Event(
                rs.getLong("id"), rs.getObject("occurred_at", java.time.OffsetDateTime.class), rs.getString("level"),
                rs.getObject("tenant_id", UUID.class), rs.getObject("actor_id", UUID.class), rs.getString("category"),
                rs.getString("summary"), rs.getString("request_method"), rs.getString("request_path"),
                (Integer) rs.getObject("http_status"), rs.getString("exception_type")),
                level, tenantId, size, (long) page * size);
        long total = control.queryForObject("""
                SELECT coalesce((SELECT total_count FROM app.list_platform_technical_logs(?,?,1,0)),0)
                """, Long.class, level, tenantId);
        return new PageImpl<>(rows, PageRequest.of(page, size), total);
    }

    static String sanitizePath(String path) {
        if (path == null) return null;
        String clean = path.split("[?#]", 2)[0];
        clean = clean.replaceAll("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", ":id");
        clean = clean.replaceAll("/\\d+(?=/|$)", "/:id");
        return clean.length() > 200 ? clean.substring(0, 200) : clean;
    }

    private static String safe(String value, int max) {
        if (value == null) return null;
        String clean = value.replaceAll("[\\r\\n\\t]", " ").trim();
        return clean.length() > max ? clean.substring(0, max) : clean;
    }
}
