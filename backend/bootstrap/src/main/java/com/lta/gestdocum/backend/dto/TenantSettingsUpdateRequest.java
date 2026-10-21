package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record TenantSettingsUpdateRequest(
    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "El color debe ser un hexadecimal válido (#RRGGBB)")
    String primaryColor,

    @Size(max = 500)
    String logoUrl,

    @Pattern(regexp = "^[A-Za-z]{3}$", message = "La moneda debe ser un código ISO de 3 letras (USD, EUR, BOB, etc.)")
    String currency,

    @Size(max = 50)
    String timezone,

    @Size(max = 20)
    String dateFormat,

    @Pattern(regexp = "^[a-z]{2}(-[A-Z]{2})?$", message = "El idioma debe ser un código de idioma válido (es, en, etc.)")
    String defaultLanguage
) {}
