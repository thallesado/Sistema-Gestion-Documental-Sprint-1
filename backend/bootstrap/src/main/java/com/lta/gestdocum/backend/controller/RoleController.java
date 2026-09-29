package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.RolePermissionsResponse;
import com.lta.gestdocum.backend.dto.RoleResponse;
import com.lta.gestdocum.backend.dto.UpdateRolePermissionsRequest;
import com.lta.gestdocum.backend.service.RoleService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {
    private final RoleService service;

    public RoleController(RoleService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user:read')")
    public List<RoleResponse> activeRoles() {
        return service.activeRoles();
    }

    @GetMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('role:read')")
    public RolePermissionsResponse getPermissions(@PathVariable Long id) {
        return service.getRolePermissions(id);
    }

    @PutMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('role:update')")
    public RolePermissionsResponse updatePermissions(
            @PathVariable Long id, @Valid @RequestBody UpdateRolePermissionsRequest request) {
        return service.updateRolePermissions(id, request.permissionIds());
    }
}
