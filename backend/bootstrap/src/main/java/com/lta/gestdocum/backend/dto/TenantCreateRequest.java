package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record TenantCreateRequest(
    @NotBlank String name,
    @NotBlank String code,
    @NotBlank
    @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$",
            message = "El slug solo admite minúsculas, números y guiones simples (ej. clinica-central)")
    String slug,
    @Email @NotBlank String email,
    UUID planId,
    @Email String adminEmail,
    String adminName
) {
    public TenantCreateRequest(String name, String code, String slug, String email) {
        this(name, code, slug, email, null, null, null);
    }
}
