package com.lta.gestdocum.backend.dto;
import jakarta.validation.constraints.*;
public record TenantCreateRequest(@NotBlank String name, @NotBlank String code,
                                   @NotBlank String slug, @Email @NotBlank String email) {}
