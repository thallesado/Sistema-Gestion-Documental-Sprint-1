package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record TenantSettingsResponse(
    UUID tenantId,
    String name,
    String primaryColor,
    String logoUrl,
    String currency,
    String timezone,
    String dateFormat,
    String defaultLanguage
) {}
