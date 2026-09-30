package com.lta.gestdocum.autenticacion.application.service;

import com.lta.gestdocum.autenticacion.domain.model.RevokedAccessToken;
import com.lta.gestdocum.autenticacion.domain.repository.RevokedAccessTokenRepository;
import com.lta.gestdocum.shared.security.AuthenticatedUser;
import com.lta.gestdocum.shared.security.AuthenticatedUserContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

@Service
public class JpaRevokedAccessTokenStore implements RevokedAccessTokenStore {
    private final RevokedAccessTokenRepository repository;
    private final AuthenticatedUserContext userContext;

    public JpaRevokedAccessTokenStore(RevokedAccessTokenRepository repository,
                                      AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Override
    public boolean hasActiveRevocation(AuthenticatedUser identity, String tokenHash, OffsetDateTime now) {
        establishScope(identity);
        return repository.existsActiveByTokenHash(tokenHash, now);
    }

    @Override
    public void save(AuthenticatedUser identity, RevokedAccessToken revokedToken) {
        establishScope(identity);
        repository.save(revokedToken);
    }

    private void establishScope(AuthenticatedUser identity) {
        if (!identity.equals(userContext.require())) {
            throw new AccessDeniedException("La identidad del token no coincide con la sesión autenticada");
        }
        if (identity.tenantId() != null) {
            userContext.establishDatabaseContext();
        }
    }
}
