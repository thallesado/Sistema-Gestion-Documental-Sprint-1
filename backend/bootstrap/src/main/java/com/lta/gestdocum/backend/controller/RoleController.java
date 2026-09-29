package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.CreateRoleRequest;
import com.lta.gestdocum.backend.dto.RolePermissionsResponse;
import com.lta.gestdocum.backend.dto.RoleResponse;
import com.lta.gestdocum.backend.dto.UpdateRolePermissionsRequest;
import com.lta.gestdocum.backend.dto.UpdateRoleStatusRequest;
import com.lta.gestdocum.backend.service.RoleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
    public List<RoleResponse> roles(@RequestParam(defaultValue = "false") boolean includeInactive) {
        return service.roles(includeInactive);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('role:create')")
    public RoleResponse create(@Valid @RequestBody CreateRoleRequest request) {
        return service.createRole(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('role:update')")
    public RoleResponse update(@PathVariable Long id, @Valid @RequestBody CreateRoleRequest request) {
        return service.updateRole(id, request);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('role:update')")
    public RoleResponse setStatus(@PathVariable Long id, @Valid @RequestBody UpdateRoleStatusRequest request) {
        return service.setStatus(id, request.isActive());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('role:delete')")
    public void delete(@PathVariable Long id) {
        service.deleteRole(id);
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
