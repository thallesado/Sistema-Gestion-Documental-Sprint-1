package com.lta.gestdocum.autenticacion.application.service;

import com.lta.gestdocum.autenticacion.domain.model.RevokedAccessToken;
import com.lta.gestdocum.shared.security.AuthenticatedUser;

import java.time.OffsetDateTime;

public interface RevokedAccessTokenStore {
    boolean hasActiveRevocation(AuthenticatedUser identity, String tokenHash, OffsetDateTime now);

    void save(AuthenticatedUser identity, RevokedAccessToken revokedToken);
}
