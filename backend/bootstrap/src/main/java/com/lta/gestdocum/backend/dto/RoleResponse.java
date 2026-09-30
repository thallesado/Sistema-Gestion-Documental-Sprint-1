package com.lta.gestdocum.backend.dto;

public record RoleResponse(Long id, String name, String description, boolean system, boolean active,
                           int permissionCount, long userCount) {
}
