package com.lta.gestdocum.usuarios.application.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.Set;

public record UpdateRolePermissionsRequest(@NotEmpty Set<Long> permissionIds) {
}
