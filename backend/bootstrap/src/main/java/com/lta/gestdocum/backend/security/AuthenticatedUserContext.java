package com.lta.gestdocum.backend.security;

import com.lta.gestdocum.backend.exception.TenantRequiredException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;
import java.util.Collection;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AuthenticatedUserContext {

    private final EntityManager entityManager;

    public AuthenticatedUserContext() {
        this.entityManager = null;
    }

    @Autowired
    public AuthenticatedUserContext(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public AuthenticatedUser require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new AuthenticationCredentialsNotFoundException("Se requiere autenticación");
        }
        return user;
    }

    public UUID requireUserId() {
        return require().userId();
    }

    public UUID requireTenantId() {
        UUID tenantId = require().tenantId();
        if (tenantId == null) {
            throw new TenantRequiredException();
        }
        return tenantId;
    }

    public boolean hasAuthority(String authority) {
        return require().authorities().contains(authority);
    }

    /**
     * El rol de aplicación usa RLS; los parámetros se fijan LOCALMENTE en la
     * transacción actual y nunca se aceptan desde la petición HTTP.
     */
    public void establishDatabaseContext() {
        establishDatabaseContext(require());
    }

    /**
     * Usa únicamente la identidad que el backend ya validó (por ejemplo, tras
     * un login exitoso), sin aceptar identidad ni tenant del cliente.
     */
    public void establishDatabaseContext(AuthenticatedUser user) {
        if (user.tenantId() == null) {
            throw new TenantRequiredException();
        }
        entityManager.createNativeQuery("SET LOCAL ROLE nexodocs_app").executeUpdate();
        entityManager.createNativeQuery(
                "select set_config('app.tenant_id', :tenant, true), " +
                "set_config('app.user_id', :user, true)")
                .setParameter("tenant", user.tenantId().toString())
                .setParameter("user", user.userId().toString())
                .getResultList();
    }
}
