package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.RolePermissionsResponse;
import com.lta.gestdocum.backend.dto.RolePermissionsResponse.Item;
import com.lta.gestdocum.backend.dto.RolePermissionsResponse.PermissionModuleGroup;
import com.lta.gestdocum.backend.dto.RoleResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Permission;
import com.lta.gestdocum.backend.model.Role;
import com.lta.gestdocum.backend.repository.PermissionRepository;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RoleService {
    private final RoleRepository repository;
    private final PermissionRepository permissionRepository;
    private final AuthenticatedUserContext context;

    public RoleService(RoleRepository repository, PermissionRepository permissionRepository,
                       AuthenticatedUserContext context) {
        this.repository = repository;
        this.permissionRepository = permissionRepository;
        this.context = context;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> activeRoles() {
        var tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        return repository.findByTenantIdAndIsActiveTrueOrderByNameAsc(tenantId).stream()
                .map(role -> new RoleResponse(role.getId(), role.getName(),
                        role.getDescription(), role.isSystem()))
                .toList();
    }

    @Transactional(readOnly = true)
    public RolePermissionsResponse getRolePermissions(Long roleId) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        Role role = repository.findByIdAndTenantId(roleId, tenantId)
                .orElseThrow(() -> new NotFoundException("Rol no encontrado"));
        Set<Long> granted = repository.findPermissionIds(tenantId, roleId);
        List<Permission> catalog = permissionRepository.findByIsActiveTrueOrderByModuleAscActionAsc();
        var byModule = catalog.stream().collect(
                Collectors.groupingBy(Permission::getModule, LinkedHashMap::new, Collectors.toList()));
        List<PermissionModuleGroup> modules = byModule.entrySet().stream()
                .map(entry -> new PermissionModuleGroup(entry.getKey(), entry.getValue().stream()
                        .map(p -> new Item(p.getId(), p.getCode(), p.getDescription(),
                                p.getCriticality(), granted.contains(p.getId())))
                        .toList()))
                .toList();
        return new RolePermissionsResponse(role.getId(), role.getName(), modules);
    }

    @Transactional
    public RolePermissionsResponse updateRolePermissions(Long roleId, Set<Long> permissionIds) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        repository.findByIdAndTenantId(roleId, tenantId)
                .orElseThrow(() -> new NotFoundException("Rol no encontrado"));
        var validIds = permissionRepository.findAllById(permissionIds).stream()
                .filter(Permission::isActive).map(Permission::getId).collect(Collectors.toSet());
        if (!validIds.equals(permissionIds)) {
            throw new IllegalArgumentException("Contiene permisos inválidos o inactivos");
        }
        repository.clearPermissions(tenantId, roleId);
        permissionIds.forEach(id -> repository.grantPermission(tenantId, roleId, id));
        return getRolePermissions(roleId);
    }
}
