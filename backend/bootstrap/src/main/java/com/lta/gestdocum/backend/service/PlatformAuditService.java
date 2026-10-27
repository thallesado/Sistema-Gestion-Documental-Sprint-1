package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.ReportPageResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Auditoría propia del administrador global (migración 062). Cada acción de plataforma llama a
 * {@link #record} dentro de su transacción: si el registro falla, la acción se revierte. La tabla es
 * inmutable en la base y nexodocs_app no tiene privilegios; se escribe con el usuario de conexión.
 */
@Service
public class PlatformAuditService {
    public static final int MIN_REASON_LENGTH = 5;
    public static final int MAX_REASON_LENGTH = 1000;
    private static final int MAX_EXPORT_ROWS = 100_000;

    /** Acciones de plataforma registradas; el filtro de la vista solo acepta estas. */
    public static final List<String> ACTIONS = List.of(
            "TENANT_CREATED", "TENANT_SUSPENDED", "TENANT_REACTIVATED", "TENANT_STATUS_CHANGED",
            "TENANT_TRIAL_EXTENDED", "TENANT_PLAN_CHANGED", "PLATFORM_BACKUP_REQUESTED",
            "PLAN_UPDATED", "PLAN_LIMITS_UPDATED", "PLAN_FEATURES_UPDATED", "PLAN_PRICE_CHANGED",
            "PLAN_PRICE_MIGRATION_SCHEDULED", "ROLE_TEMPLATE_CREATED", "ROLE_TEMPLATE_UPDATED", "ROLE_TEMPLATE_DELETED",
            "ADDON_CREATED", "ADDON_UPDATED", "ADDON_PRICE_CHANGED", "TENANT_ADDON_GRANTED", "TENANT_ADDON_REVOKED");

    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;
    private final ObjectMapper objectMapper;

    public PlatformAuditService(NamedParameterJdbcTemplate db, AuthenticatedUserContext context, ObjectMapper objectMapper) {
        this.db = db;
        this.context = context;
        this.objectMapper = objectMapper;
    }

    /** Motivo normalizado; falla antes de ejecutar la acción si falta o es demasiado corto. */
    public static String requireReason(String reason) {
        String normalized = reason == null ? "" : reason.trim().replaceAll("\\s+", " ");
        if (normalized.length() < MIN_REASON_LENGTH) {
            throw new IllegalArgumentException("Indica el motivo de la acción (mínimo " + MIN_REASON_LENGTH + " caracteres)");
        }
        if (normalized.length() > MAX_REASON_LENGTH) {
            throw new IllegalArgumentException("El motivo no puede superar " + MAX_REASON_LENGTH + " caracteres");
        }
        return normalized;
    }

    /** Solo cuentas de plataforma (sin tenant). */
    public AuthenticatedUser requirePlatformAccount() {
        AuthenticatedUser actor = context.require();
        if (actor.tenantId() != null || !actor.authorities().contains("platform:tenant:manage")) {
            throw new AccessDeniedException("La acción requiere una cuenta de administración global");
        }
        return actor;
    }

    /** Registra una acción de plataforma. Sin motivo válido no se registra ni se ejecuta. */
    @Transactional
    public void record(String action, UUID tenantId, String reason, Map<String, ?> before, Map<String, ?> after) {
        if (!ACTIONS.contains(action)) throw new IllegalArgumentException("Acción de plataforma desconocida: " + action);
        String normalizedReason = requireReason(reason);
        AuthenticatedUser actor = requirePlatformAccount();
        db.update("""
                insert into platform_audit_events
                  (actor_user_id, actor_username, action, tenant_id, reason, before_state, after_state, ip_address)
                values (:actor, :username, :action, :tenant, :reason, cast(:before as jsonb), cast(:after as jsonb),
                  cast(:ip as inet))
                """, new MapSqlParameterSource()
                .addValue("actor", actor.userId())
                .addValue("username", actor.username())
                .addValue("action", action)
                .addValue("tenant", tenantId)
                .addValue("reason", normalizedReason)
                .addValue("before", json(before))
                .addValue("after", json(after))
                .addValue("ip", clientIp()));
    }

    // ------------------------------------------------------------------ consulta

    @Transactional(readOnly = true)
    public ReportPageResponse<Map<String, Object>> search(Map<String, String> filters, int page, int size) {
        requirePlatformAccount();
        Query query = query(filters);
        int safeSize = Math.max(1, Math.min(size, 200));
        int safePage = Math.max(1, page);
        Long total = db.queryForObject("select count(*) from platform_audit_events e" + query.where(), query.params(), Long.class);
        MapSqlParameterSource params = query.params().addValue("limit", safeSize).addValue("offset", (safePage - 1) * safeSize);
        List<Map<String, Object>> rows = db.queryForList(SELECT + query.where() + ORDER + " limit :limit offset :offset", params)
                .stream().map(PlatformAuditService::row).toList();
        return ReportPageResponse.of(rows, total == null ? 0 : total, safePage, safeSize);
    }

    /** Eventos de plataforma de una organización para su ficha (más recientes primero). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> forTenant(UUID tenantId, int limit) {
        return db.queryForList(SELECT + " where e.tenant_id = :tenant" + ORDER + " limit :limit",
                new MapSqlParameterSource("tenant", tenantId).addValue("limit", Math.max(1, Math.min(limit, 200))))
                .stream().map(PlatformAuditService::row).toList();
    }

    @Transactional(readOnly = true)
    public ReportService.CsvExport exportCsv(Map<String, String> filters) {
        requirePlatformAccount();
        Query query = query(filters);
        Long total = db.queryForObject("select count(*) from platform_audit_events e" + query.where(), query.params(), Long.class);
        if (total != null && total > MAX_EXPORT_ROWS) throw new ReportService.ExportTooLargeException(total, MAX_EXPORT_ROWS);
        List<Map<String, Object>> rows = db.queryForList(SELECT + query.where() + ORDER, query.params())
                .stream().map(PlatformAuditService::row).toList();
        LinkedHashMap<String, String> headers = new LinkedHashMap<>();
        headers.put("occurredAt", "Fecha"); headers.put("actor", "Administrador"); headers.put("action", "Acción");
        headers.put("tenant", "Organización"); headers.put("reason", "Motivo"); headers.put("before", "Antes");
        headers.put("after", "Después"); headers.put("ipAddress", "IP");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(out, true, StandardCharsets.UTF_8)) {
            writer.write('﻿'); // BOM para Excel
            writer.println(String.join(",", headers.values()));
            for (Map<String, Object> row : rows) {
                StringJoiner line = new StringJoiner(",");
                for (String key : headers.keySet()) {
                    Object cell = row.get(key);
                    line.add("\"" + ReportService.escape(cell == null ? "" : String.valueOf(cell)) + "\"");
                }
                writer.println(line);
            }
        }
        return new ReportService.CsvExport(out.toByteArray(), total == null ? 0 : total);
    }

    private static final String SELECT = """
            select e.id, e.occurred_at, e.actor_username as actor, e.action, e.tenant_id, t.name as tenant,
              e.reason, e.before_state::text as before, e.after_state::text as after, host(e.ip_address) as ip_address
            from platform_audit_events e left join tenants t on t.id = e.tenant_id
            """;
    private static final String ORDER = " order by e.occurred_at desc, e.id desc";

    private record Query(String where, MapSqlParameterSource params) { }

    private static Query query(Map<String, String> filters) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        StringJoiner where = new StringJoiner(" and ", " where ", "").setEmptyValue("");
        String from = trimToNull(filters.get("dateFrom"));
        String to = trimToNull(filters.get("dateTo"));
        LocalDate fromDate = from == null ? null : date(from, "dateFrom");
        LocalDate toDate = to == null ? null : date(to, "dateTo");
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new IllegalArgumentException("La fecha Desde no puede ser posterior a la fecha Hasta");
        }
        if (fromDate != null) {
            where.add("e.occurred_at >= :from");
            p.addValue("from", OffsetDateTime.of(fromDate.atStartOfDay(), ZoneOffset.UTC));
        }
        if (toDate != null) {
            where.add("e.occurred_at < :to");
            p.addValue("to", OffsetDateTime.of(toDate.plusDays(1).atStartOfDay(), ZoneOffset.UTC));
        }
        String action = trimToNull(filters.get("action"));
        if (action != null) {
            if (!ACTIONS.contains(action)) throw new IllegalArgumentException("Acción de plataforma no válida");
            where.add("e.action = :action");
            p.addValue("action", action);
        }
        String tenant = trimToNull(filters.get("tenantId"));
        if (tenant != null) {
            try { p.addValue("tenant", UUID.fromString(tenant)); }
            catch (IllegalArgumentException invalid) { throw new IllegalArgumentException("Organización no válida"); }
            where.add("e.tenant_id = :tenant");
        }
        String actor = trimToNull(filters.get("actor"));
        if (actor != null) {
            where.add("e.actor_username ilike :actor");
            p.addValue("actor", "%" + actor + "%");
        }
        return new Query(where.toString(), p);
    }

    private static Map<String, Object> row(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", row.get("id"));
        Object occurred = row.get("occurred_at");
        out.put("occurredAt", occurred instanceof java.sql.Timestamp ts ? ts.toInstant().toString()
                : occurred instanceof OffsetDateTime odt ? odt.toInstant().toString() : occurred);
        out.put("actor", row.get("actor"));
        out.put("action", row.get("action"));
        out.put("tenantId", row.get("tenant_id"));
        out.put("tenant", row.get("tenant"));
        out.put("reason", row.get("reason"));
        out.put("before", row.get("before"));
        out.put("after", row.get("after"));
        out.put("ipAddress", row.get("ip_address"));
        return out;
    }

    private String json(Map<String, ?> value) {
        if (value == null || value.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo registrar el estado de la acción", exception);
        }
    }

    /** IP directa de la conexión: X-Forwarded-For se puede falsificar (ver PublicEndpointRateLimitFilter). */
    private static String clientIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest().getRemoteAddr();
        }
        return null;
    }

    private static LocalDate date(String value, String name) {
        try { return LocalDate.parse(value.substring(0, Math.min(10, value.length()))); }
        catch (RuntimeException exception) { throw new IllegalArgumentException("Fecha inválida en " + name); }
    }

    private static String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
