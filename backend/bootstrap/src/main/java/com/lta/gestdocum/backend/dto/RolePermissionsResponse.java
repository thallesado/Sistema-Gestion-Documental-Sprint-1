package com.lta.gestdocum.backend.dto;

import java.util.List;

public record RolePermissionsResponse(Long roleId, String roleName, List<PermissionModuleGroup> modules) {
    public record PermissionModuleGroup(String module, List<Item> permissions) {
    }

    public record Item(Long id, String code, String description, String criticality, boolean granted) {
    }
}
