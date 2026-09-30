package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record CreateRoleRequest(@NotBlank @Size(max = 80) String name,
                                @Size(max = 255) String description,
                                @NotEmpty Set<Long> permissionIds) {
}
