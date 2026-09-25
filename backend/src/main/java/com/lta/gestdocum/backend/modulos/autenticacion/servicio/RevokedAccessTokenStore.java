package com.lta.gestdocum.backend.modulos.autenticacion.servicio;

import com.lta.gestdocum.backend.modulos.autenticacion.modelo.RevokedAccessToken;
import com.lta.gestdocum.backend.comun.seguridad.AuthenticatedUser;

import java.time.OffsetDateTime;

public interface RevokedAccessTokenStore {
    boolean hasActiveRevocation(AuthenticatedUser identity, String tokenHash, OffsetDateTime now);

    void save(AuthenticatedUser identity, RevokedAccessToken revokedToken);
}
