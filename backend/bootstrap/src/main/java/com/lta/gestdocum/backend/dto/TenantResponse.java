package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

/**
 * {@code temporaryPassword} solo viaja en la respuesta del alta que hace un superadmin y únicamente cuando el
 * correo de bienvenida no pudo entregarla; nunca se registra en el log ni se devuelve en el alta pública.
 */
public record TenantResponse(
    UUID id,
    String name,
    String code,
    String slug,
    String status,
    UUID planId,
    String logoUrl,
    String primaryColor,
    @JsonInclude(JsonInclude.Include.NON_NULL) String temporaryPassword
) {
    public TenantResponse(UUID id, String name, String code, String slug, String status, UUID planId,
                          String logoUrl, String primaryColor) {
        this(id, name, code, slug, status, planId, logoUrl, primaryColor, null);
    }

    public TenantResponse(UUID id, String name, String code, String slug, String status) {
        this(id, name, code, slug, status, null, null, null, null);
    }

    public TenantResponse withTemporaryPassword(String password) {
        return new TenantResponse(id, name, code, slug, status, planId, logoUrl, primaryColor, password);
    }
}
