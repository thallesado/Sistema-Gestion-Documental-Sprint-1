package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record TenantResponse(
    UUID id,
    String name,
    String code,
    String slug,
    String status,
    UUID planId,
    String logoUrl,
    String primaryColor
) {
    public TenantResponse(UUID id, String name, String code, String slug, String status) {
        this(id, name, code, slug, status, null, null, null);
    }
}
