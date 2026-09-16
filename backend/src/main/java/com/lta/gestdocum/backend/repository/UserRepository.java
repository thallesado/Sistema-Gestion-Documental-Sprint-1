package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    @Query("""
        SELECT u FROM User u
        WHERE u.tenantId = :tenantId
          AND (LOWER(u.username) = LOWER(:identifier)
            OR LOWER(u.email) = LOWER(:identifier))
        """)
    Optional<User> findByTenantAndIdentifier(
            @Param("tenantId") UUID tenantId,
            @Param("identifier") String identifier);

    Optional<User> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);

    Optional<User> findByIdAndDeletedAtIsNull(UUID id);

    @Query("""
        SELECT u FROM User u
        WHERE u.tenantId = :tenantId
          AND u.deletedAt IS NULL
          AND (
            :filter IS NULL OR :filter = ''
            OR LOWER(u.username) LIKE LOWER(CONCAT('%', :filter, '%'))
            OR LOWER(u.email) LIKE LOWER(CONCAT('%', :filter, '%'))
            OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :filter, '%'))
            OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :filter, '%'))
          )
        """)
    Page<User> findActiveByTenant(
            @Param("tenantId") UUID tenantId,
            @Param("filter") String filter,
            Pageable pageable);

    @Query(value = """
        SELECT DISTINCT p.code
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
        JOIN role_permissions rp ON rp.role_id = r.id AND rp.tenant_id = ur.tenant_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = :userId
          AND ur.tenant_id = :tenantId
          AND r.is_active = true
          AND p.is_active = true
        """, nativeQuery = true)
    List<String> findAuthorityCodes(
            @Param("userId") UUID userId,
            @Param("tenantId") UUID tenantId);
}