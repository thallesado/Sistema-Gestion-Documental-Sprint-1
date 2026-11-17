package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditActorResponse;
import com.lta.gestdocum.backend.dto.AuditEventResponse;
import com.lta.gestdocum.backend.dto.AuditResourceResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import javax.sql.DataSource;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Read-only access to immutable audit evidence after an isolated tenant database is deleted. */
@Service
@ConditionalOnProperty(name = "app.tenant-databases.routing-enabled", havingValue = "true")
public class TenantAuditArchiveService {
    private static final int MAX_PAGE_SIZE = 100;
    private final JdbcTemplate control;

    public TenantAuditArchiveService(@Qualifier("controlDataSource") DataSource controlDataSource) {
        this.control = new JdbcTemplate(controlDataSource);
    }

    public Page<AuditEventResponse> list(UUID platformActorId, UUID tenantId, Pageable requested) {
        int page = Math.max(requested.getPageNumber(), 0);
        int size = Math.min(Math.max(requested.getPageSize(), 1), MAX_PAGE_SIZE);
        long offset = (long) page * size;
        long total = control.queryForObject(
                "SELECT app.authorized_tenant_audit_archive_count(?,?)", Long.class, platformActorId, tenantId);
        List<AuditEventResponse> events = control.query("""
                SELECT source_event_id,tenant_id,user_id,platform_actor_id,action,entity_type,entity_id,
                       occurred_at,client_timestamp,client_timezone,ip_address::text AS ip_address,
                       user_agent,result,details::text AS details,chain_seq,previous_hash,record_hash
                FROM app.authorized_tenant_audit_archive_page(?,?,?,?)
                """, (row, index) -> {
            UUID userId = row.getObject("user_id", UUID.class);
            UUID platformId = row.getObject("platform_actor_id", UUID.class);
            String action = row.getString("action");
            String entityType = row.getString("entity_type");
            UUID entityId = row.getObject("entity_id", UUID.class);
            AuditActorResponse actor = platformId != null
                    ? new AuditActorResponse(platformId, "PLATFORM")
                    : userId == null ? null : new AuditActorResponse(userId, "TENANT");
            String details = row.getString("details");
            return new AuditEventResponse(row.getLong("source_event_id"), tenantId, userId, platformId,
                    action, entityType, entityId, row.getObject("occurred_at", OffsetDateTime.class),
                    row.getObject("client_timestamp", OffsetDateTime.class), row.getString("client_timezone"),
                    row.getString("result"), row.getString("ip_address"), row.getString("user_agent"), actor,
                    new AuditResourceResponse(entityType, entityId), details == null || details.isBlank() ? "{}" : details,
                    row.getObject("chain_seq", Long.class), row.getString("previous_hash"), row.getString("record_hash"));
        }, platformActorId, tenantId, size, offset);
        Pageable pageRequest = PageRequest.of(page, size, Sort.by(Sort.Order.desc("occurredAt"), Sort.Order.desc("id")));
        return new PageImpl<>(events, pageRequest, total);
    }
}
