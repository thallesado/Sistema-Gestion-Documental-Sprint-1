package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record TenantCreateRequest(
    @NotBlank String name,
    @NotBlank String code,
    @NotBlank String slug,
    @Email @NotBlank String email,
    UUID planId,
    @Email String adminEmail,
    String adminName
) {
    public TenantCreateRequest(String name, String code, String slug, String email) {
        this(name, code, slug, email, null, null, null);
    }
}
