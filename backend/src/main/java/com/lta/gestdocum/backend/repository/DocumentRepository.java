package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByTenantIdAndNameContainingIgnoreCase(UUID tenantId, String name);

    List<Document> findByTenantIdAndNameContainingIgnoreCaseOrTenantIdAndDescriptionContainingIgnoreCase(
        UUID tenantId1, String name, UUID tenantId2, String description
    );

    Page<Document> findByTenantIdAndNameContainingIgnoreCase(UUID tenantId, String name, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null
          and (lower(d.name) like lower(concat('%', :filter, '%'))
            or lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%'))
            or lower(d.code) like lower(concat('%', :filter, '%')))
        """)
    Page<Document> searchByTenant(UUID tenantId, String filter, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null and d.status = :status
          and (lower(d.name) like lower(concat('%', :filter, '%'))
            or lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%'))
            or lower(d.code) like lower(concat('%', :filter, '%')))
        """)
    Page<Document> searchByTenantAndStatus(UUID tenantId, String filter, Document.DocumentStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null
          and (d.authorId = :userId or d.responsibleId = :userId)
          and (:status is null or d.status = :status)
          and (lower(d.name) like lower(concat('%', :filter, '%'))
            or lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%'))
            or lower(d.code) like lower(concat('%', :filter, '%')))
        """)
    Page<Document> searchMine(UUID tenantId, UUID userId, String filter,
                              Document.DocumentStatus status, Pageable pageable);

    java.util.Optional<Document> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);

    List<Document> findByTenantIdAndStatus(UUID tenantId, Document.DocumentStatus status);

    List<Document> findByTenantIdAndStatusAndDeletedAtIsNull(UUID tenantId, Document.DocumentStatus status);

    @org.springframework.data.jpa.repository.Query(value = """
        select d.* from documents d
        join clinical_document_links link
          on link.tenant_id = d.tenant_id and link.document_id = d.id
        where d.tenant_id = :tenantId and link.clinical_history_id = :historyId
          and d.deleted_at is null
        order by d.created_at desc
        """, nativeQuery = true)
    List<Document> findLinkedToClinicalHistory(UUID tenantId, UUID historyId);
}
