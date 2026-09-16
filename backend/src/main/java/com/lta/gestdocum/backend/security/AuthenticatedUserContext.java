package com.lta.gestdocum.backend.security;

import com.lta.gestdocum.backend.exception.TenantRequiredException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class AuthenticatedUserContext {

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
}
