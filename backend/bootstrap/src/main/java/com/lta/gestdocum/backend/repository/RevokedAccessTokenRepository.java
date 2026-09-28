package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.RevokedAccessToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;

@Repository
public interface RevokedAccessTokenRepository extends JpaRepository<RevokedAccessToken, String> {

    @Query("""
            SELECT CASE WHEN COUNT(token) > 0 THEN true ELSE false END
              FROM RevokedAccessToken token
             WHERE token.tokenHash = :tokenHash
               AND token.expiresAt > :now
            """)
    boolean existsActiveByTokenHash(
            @Param("tokenHash") String tokenHash,
            @Param("now") OffsetDateTime now);
}
