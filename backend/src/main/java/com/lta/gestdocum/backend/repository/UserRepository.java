package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

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

    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    Optional<User> findByUsernameOrEmail(String username, String email);
}