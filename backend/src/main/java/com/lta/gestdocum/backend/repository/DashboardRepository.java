package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Expedient;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface DashboardRepository extends Repository<Expedient, UUID> {

    interface TaskProjection {
        UUID getId();
        UUID getDocumentId();
        String getTitle();
        String getStatus();
        Integer getPriority();
        OffsetDateTime getDueAt();
    }

    interface ActivityProjection {
        Long getId();
        UUID getUserId();
        String getActorName();
        String getAction();
        String getEntityType();
        UUID getEntityId();
        OffsetDateTime getOccurredAt();
        String getResult();
    }

    interface DocumentProjection {
        UUID getId();
        UUID getExpedientId();
        String getCode();
        String getName();
        String getStatus();
        OffsetDateTime getUpdatedAt();
    }

    @Query(value = """
            SELECT t.id AS id, t.document_id AS documentId, t.title AS title,
                   CAST(t.status AS text) AS status, t.priority AS priority, t.due_at AS dueAt
            FROM workflow_tasks t
            WHERE t.tenant_id = :tenantId
              AND t.assigned_user_id = :userId
              AND t.status IN ('PENDING', 'IN_PROGRESS', 'OVERDUE')
            ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END,
                     t.due_at ASC, t.priority ASC, t.created_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<TaskProjection> findMyTasks(@Param("tenantId") UUID tenantId,
                                     @Param("userId") UUID userId,
                                     @Param("limit") int limit);

    @Query(value = """
            SELECT a.id AS id, a.user_id AS userId,
                   trim(concat(coalesce(u.first_name, ''), ' ', coalesce(u.last_name, ''))) AS actorName,
                   a.action AS action, a.entity_type AS entityType, a.entity_id AS entityId,
                   a.occurred_at AS occurredAt, a.result AS result
            FROM audit_events a
            LEFT JOIN users u ON u.id = a.user_id AND u.tenant_id = a.tenant_id
            WHERE a.tenant_id = :tenantId
            ORDER BY a.occurred_at DESC, a.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<ActivityProjection> findRecentActivity(@Param("tenantId") UUID tenantId,
                                                @Param("limit") int limit);

    @Query(value = """
            SELECT d.id AS id, d.expedient_id AS expedientId, d.code AS code,
                   d.name AS name, d.status::text AS status, d.updated_at AS updatedAt
            FROM documents d
            WHERE d.tenant_id = :tenantId
              AND d.deleted_at IS NULL
            ORDER BY d.updated_at DESC, d.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<DocumentProjection> findRecentDocuments(@Param("tenantId") UUID tenantId,
                                                 @Param("limit") int limit);
}
