package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.RevokedAccessToken;
import com.lta.gestdocum.backend.security.AuthenticatedUser;

import java.time.OffsetDateTime;

public interface RevokedAccessTokenStore {
    boolean hasActiveRevocation(AuthenticatedUser identity, String tokenHash, OffsetDateTime now);

    void save(AuthenticatedUser identity, RevokedAccessToken revokedToken);
}
