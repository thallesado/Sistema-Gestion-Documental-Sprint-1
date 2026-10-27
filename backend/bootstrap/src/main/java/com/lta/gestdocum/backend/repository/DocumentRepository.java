package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {
    /** B2: campos que la búsqueda libre puede comparar; los ocultos para el perfil no se usan como filtro. */
    record SearchFields(boolean name, boolean description, boolean code, boolean specialty, boolean process) {
        public static final SearchFields ALL = new SearchFields(true, true, true, true, true);
    }

    @Query(value = "SELECT app.document_has_active_workflow(:tenantId,:documentId)", nativeQuery = true)
    boolean hasActiveWorkflow(@Param("tenantId") UUID tenantId,@Param("documentId") UUID documentId);

    List<Document> findByTenantIdAndNameContainingIgnoreCase(UUID tenantId, String name);

    List<Document> findByTenantIdAndNameContainingIgnoreCaseOrTenantIdAndDescriptionContainingIgnoreCase(
        UUID tenantId1, String name, UUID tenantId2, String description
    );

    Page<Document> findByTenantIdAndNameContainingIgnoreCase(UUID tenantId, String name, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null
          and (:filter = '' or (:#{#fields.name()} = true and lower(d.name) like lower(concat('%', :filter, '%')))
            or (:#{#fields.description()} = true and lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.code()} = true and lower(d.code) like lower(concat('%', :filter, '%')))
            or (:#{#fields.specialty()} = true and lower(coalesce(d.specialty, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.process()} = true and lower(coalesce(d.institutionalProcess, '')) like lower(concat('%', :filter, '%'))))
        """)
    Page<Document> searchByTenant(UUID tenantId, String filter, @Param("fields") SearchFields fields, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null and d.status = :status
          and (:filter = '' or (:#{#fields.name()} = true and lower(d.name) like lower(concat('%', :filter, '%')))
            or (:#{#fields.description()} = true and lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.code()} = true and lower(d.code) like lower(concat('%', :filter, '%')))
            or (:#{#fields.specialty()} = true and lower(coalesce(d.specialty, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.process()} = true and lower(coalesce(d.institutionalProcess, '')) like lower(concat('%', :filter, '%'))))
        """)
    Page<Document> searchByTenantAndStatus(UUID tenantId, String filter, Document.DocumentStatus status, @Param("fields") SearchFields fields, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null
          and (d.authorId = :userId or d.responsibleId = :userId)
          and (:filter = '' or (:#{#fields.name()} = true and lower(d.name) like lower(concat('%', :filter, '%')))
            or (:#{#fields.description()} = true and lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.code()} = true and lower(d.code) like lower(concat('%', :filter, '%')))
            or (:#{#fields.specialty()} = true and lower(coalesce(d.specialty, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.process()} = true and lower(coalesce(d.institutionalProcess, '')) like lower(concat('%', :filter, '%'))))
        """)
    Page<Document> searchMine(UUID tenantId, UUID userId, String filter, @Param("fields") SearchFields fields, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null
          and (d.authorId = :userId or d.responsibleId = :userId)
          and d.status = :status
          and (:filter = '' or (:#{#fields.name()} = true and lower(d.name) like lower(concat('%', :filter, '%')))
            or (:#{#fields.description()} = true and lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.code()} = true and lower(d.code) like lower(concat('%', :filter, '%')))
            or (:#{#fields.specialty()} = true and lower(coalesce(d.specialty, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.process()} = true and lower(coalesce(d.institutionalProcess, '')) like lower(concat('%', :filter, '%'))))
        """)
    Page<Document> searchMineAndStatus(UUID tenantId, UUID userId, String filter,
                                       Document.DocumentStatus status, @Param("fields") SearchFields fields, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null
          and d.authorId != :userId
          and (:filter = '' or (:#{#fields.name()} = true and lower(d.name) like lower(concat('%', :filter, '%')))
            or (:#{#fields.description()} = true and lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.code()} = true and lower(d.code) like lower(concat('%', :filter, '%')))
            or (:#{#fields.specialty()} = true and lower(coalesce(d.specialty, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.process()} = true and lower(coalesce(d.institutionalProcess, '')) like lower(concat('%', :filter, '%'))))
        """)
    Page<Document> searchShared(UUID tenantId, UUID userId, String filter, @Param("fields") SearchFields fields, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("""
        select d from Document d
        where d.tenantId = :tenantId and d.deletedAt is null
          and d.authorId != :userId
          and d.status = :status
          and (:filter = '' or (:#{#fields.name()} = true and lower(d.name) like lower(concat('%', :filter, '%')))
            or (:#{#fields.description()} = true and lower(coalesce(d.description, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.code()} = true and lower(d.code) like lower(concat('%', :filter, '%')))
            or (:#{#fields.specialty()} = true and lower(coalesce(d.specialty, '')) like lower(concat('%', :filter, '%')))
            or (:#{#fields.process()} = true and lower(coalesce(d.institutionalProcess, '')) like lower(concat('%', :filter, '%'))))
        """)
    Page<Document> searchSharedAndStatus(UUID tenantId, UUID userId, String filter,
                                         Document.DocumentStatus status, @Param("fields") SearchFields fields, Pageable pageable);

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

    long countByTenantId(UUID tenantId);
    long countByTenantIdAndDeletedAtIsNull(UUID tenantId);
}
