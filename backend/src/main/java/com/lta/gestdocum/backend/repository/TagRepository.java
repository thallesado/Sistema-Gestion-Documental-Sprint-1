package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TagRepository extends JpaRepository<Tag, UUID> {

    @Query("""
        SELECT t FROM Tag t
        WHERE t.tenantId = :tenantId
          AND (:filter IS NULL OR LOWER(t.name) LIKE LOWER(CONCAT('%', :filter, '%')))
        """)
    Page<Tag> findByTenant(
            @Param("tenantId") UUID tenantId,
            @Param("filter") String filter,
            Pageable pageable);

    Optional<Tag> findByIdAndTenantId(UUID id, UUID tenantId);

    @Query("""
        SELECT COUNT(t) > 0 FROM Tag t
        WHERE t.tenantId = :tenantId AND (:excludedId IS NULL OR t.id <> :excludedId)
          AND LOWER(t.name) = LOWER(:name)
        """)
    boolean existsDuplicate(
            @Param("tenantId") UUID tenantId,
            @Param("name") String name,
            @Param("excludedId") UUID excludedId);
}
