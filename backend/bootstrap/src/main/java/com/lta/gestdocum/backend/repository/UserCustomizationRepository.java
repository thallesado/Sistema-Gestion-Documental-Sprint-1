package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.service.UserAccessPolicy;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Acceso JDBC a user_customizations y user_allowed_document_types (migración 060). Dentro de una
 * transacción con contexto RLS, cada usuario lee su propia fila y la escritura exige user:customize.
 * El inicio de sesión la consulta sin contexto, igual que users y user_roles.
 */
@Repository
public class UserCustomizationRepository {

    /** Fila de user_customizations; los campos nulos significan "sin personalizar". */
    public record Row(String jobTitle, String language, String landingPage, LocalDate accessExpiresOn,
                      Set<Integer> accessWeekdays, LocalTime accessStartTime, LocalTime accessEndTime,
                      Integer maxUploadMb, Integer storageQuotaMb) {

        public static final Row EMPTY = new Row(null, null, null, null, Set.of(), null, null, null, null);

        public UserAccessPolicy accessPolicy() {
            return new UserAccessPolicy(accessExpiresOn, accessWeekdays, accessStartTime, accessEndTime);
        }
    }

    private final NamedParameterJdbcTemplate db;

    public UserCustomizationRepository(NamedParameterJdbcTemplate db) {
        this.db = db;
    }

    public Optional<Row> find(UUID tenantId, UUID userId) {
        return db.query("""
                SELECT job_title, language, landing_page, access_expires_on, access_weekdays,
                       access_start_time, access_end_time, max_upload_mb, storage_quota_mb
                FROM user_customizations WHERE tenant_id = :tenantId AND user_id = :userId
                """, scope(tenantId, userId), this::map).stream().findFirst();
    }

    public void upsert(UUID tenantId, UUID userId, Row row, UUID updatedBy) {
        db.update("""
                INSERT INTO user_customizations (tenant_id, user_id, job_title, language, landing_page,
                    access_expires_on, access_weekdays, access_start_time, access_end_time,
                    max_upload_mb, storage_quota_mb, updated_by, updated_at)
                VALUES (:tenantId, :userId, :jobTitle, :language, :landingPage, :expiresOn, :weekdays,
                    :startTime, :endTime, :maxUploadMb, :storageQuotaMb, :updatedBy, now())
                ON CONFLICT (tenant_id, user_id) DO UPDATE SET
                    job_title = EXCLUDED.job_title, language = EXCLUDED.language,
                    landing_page = EXCLUDED.landing_page, access_expires_on = EXCLUDED.access_expires_on,
                    access_weekdays = EXCLUDED.access_weekdays, access_start_time = EXCLUDED.access_start_time,
                    access_end_time = EXCLUDED.access_end_time, max_upload_mb = EXCLUDED.max_upload_mb,
                    storage_quota_mb = EXCLUDED.storage_quota_mb, updated_by = EXCLUDED.updated_by,
                    updated_at = now()
                """, scope(tenantId, userId)
                .addValue("jobTitle", row.jobTitle())
                .addValue("language", row.language())
                .addValue("landingPage", row.landingPage())
                .addValue("expiresOn", row.accessExpiresOn())
                .addValue("weekdays", formatWeekdays(row.accessWeekdays()))
                .addValue("startTime", row.accessStartTime() == null ? null : Time.valueOf(row.accessStartTime()))
                .addValue("endTime", row.accessEndTime() == null ? null : Time.valueOf(row.accessEndTime()))
                .addValue("maxUploadMb", row.maxUploadMb())
                .addValue("storageQuotaMb", row.storageQuotaMb())
                .addValue("updatedBy", updatedBy));
    }

    public Set<UUID> findAllowedDocumentTypes(UUID tenantId, UUID userId) {
        return new java.util.LinkedHashSet<>(db.queryForList("""
                SELECT document_type_id FROM user_allowed_document_types
                WHERE tenant_id = :tenantId AND user_id = :userId ORDER BY document_type_id
                """, scope(tenantId, userId), UUID.class));
    }

    public void replaceAllowedDocumentTypes(UUID tenantId, UUID userId, Collection<UUID> typeIds) {
        MapSqlParameterSource scope = scope(tenantId, userId);
        db.update("DELETE FROM user_allowed_document_types WHERE tenant_id = :tenantId AND user_id = :userId", scope);
        for (UUID typeId : typeIds) {
            db.update("""
                    INSERT INTO user_allowed_document_types (tenant_id, user_id, document_type_id)
                    VALUES (:tenantId, :userId, :typeId)
                    """, new MapSqlParameterSource(scope.getValues()).addValue("typeId", typeId));
        }
    }

    /** Cuántos de los tipos indicados existen y están activos en el tenant. */
    public int countActiveDocumentTypes(UUID tenantId, Collection<UUID> typeIds) {
        if (typeIds.isEmpty()) return 0;
        Integer count = db.queryForObject("""
                SELECT count(*) FROM document_types WHERE tenant_id = :tenantId AND id IN (:ids) AND is_active
                """, new MapSqlParameterSource("tenantId", tenantId).addValue("ids", typeIds), Integer.class);
        return count == null ? 0 : count;
    }

    /** Bytes de las versiones que el usuario subió (función SECURITY DEFINER de 060). */
    public long storageBytes(UUID userId) {
        Long bytes = db.queryForObject("SELECT app.user_storage_bytes(:userId)",
                new MapSqlParameterSource("userId", userId), Long.class);
        return bytes == null ? 0 : bytes;
    }

    /** Zona horaria del tenant para evaluar el horario de acceso. */
    public Optional<String> tenantTimezone(UUID tenantId) {
        return db.queryForList("SELECT timezone FROM tenants WHERE id = :tenantId",
                new MapSqlParameterSource("tenantId", tenantId), String.class).stream().findFirst();
    }

    private Row map(ResultSet rs, int rowNum) throws SQLException {
        java.sql.Date expires = rs.getDate("access_expires_on");
        Time start = rs.getTime("access_start_time");
        Time end = rs.getTime("access_end_time");
        return new Row(rs.getString("job_title"), rs.getString("language"), rs.getString("landing_page"),
                expires == null ? null : expires.toLocalDate(),
                parseWeekdays(rs.getString("access_weekdays")),
                start == null ? null : start.toLocalTime(),
                end == null ? null : end.toLocalTime(),
                (Integer) rs.getObject("max_upload_mb"),
                (Integer) rs.getObject("storage_quota_mb"));
    }

    private static MapSqlParameterSource scope(UUID tenantId, UUID userId) {
        return new MapSqlParameterSource("tenantId", tenantId).addValue("userId", userId);
    }

    static Set<Integer> parseWeekdays(String value) {
        if (value == null || value.isBlank()) return Set.of();
        return Arrays.stream(value.split(",")).map(String::trim).map(Integer::valueOf)
                .collect(Collectors.toCollection(TreeSet::new));
    }

    static String formatWeekdays(Set<Integer> days) {
        if (days == null || days.isEmpty()) return null;
        return new TreeSet<>(days).stream().map(String::valueOf).collect(Collectors.joining(","));
    }
}
