package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.CreateRoleRequest;
import com.lta.gestdocum.backend.dto.RolePermissionsResponse;
import com.lta.gestdocum.backend.dto.RolePermissionsResponse.Item;
import com.lta.gestdocum.backend.dto.RolePermissionsResponse.PermissionModuleGroup;
import com.lta.gestdocum.backend.dto.RoleResponse;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
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
    public List<RoleResponse> roles(boolean includeInactive) {
        var tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        return (includeInactive ? repository.findByTenantIdOrderByNameAsc(tenantId)
                : repository.findByTenantIdAndIsActiveTrueOrderByNameAsc(tenantId)).stream()
                .map(role -> toResponse(tenantId, role))
                .toList();
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        String name = uniqueName(tenantId, request.name(), null);
        Role role = repository.save(Role.builder().tenantId(tenantId).name(name)
                .description(request.description()).build());
        grantPermissions(tenantId, role.getId(), request.permissionIds());
        return toResponse(tenantId, role);
    }

    @Transactional
    public RoleResponse updateRole(Long id, CreateRoleRequest request) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        Role role = editableRole(id, tenantId);
        role.setName(uniqueName(tenantId, request.name(), id));
        role.setDescription(request.description());
        repository.save(role);
        grantPermissions(tenantId, id, request.permissionIds());
        return toResponse(tenantId, role);
    }

    @Transactional
    public RoleResponse setStatus(Long id, boolean active) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        Role role = editableRole(id, tenantId);
        role.setActive(active);
        return toResponse(tenantId, repository.save(role));
    }

    @Transactional
    public void deleteRole(Long id) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        Role role = editableRole(id, tenantId);
        if (repository.countUsers(tenantId, id) > 0) {
            throw new DuplicateResourceException("No se puede eliminar el rol porque tiene usuarios asignados. "
                    + "Reasigna a los usuarios antes de continuar.");
        }
        repository.delete(role); // role_permissions se elimina en cascada (FK ON DELETE CASCADE)
    }

    /** Rol del tenant autenticado; los roles de sistema son inmutables. */
    private Role editableRole(Long id, UUID tenantId) {
        Role role = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Rol no encontrado"));
        if (role.isSystem()) throw new IllegalArgumentException("Los roles de sistema no se pueden modificar, desactivar ni eliminar");
        return role;
    }

    /** Nombre normalizado y sin colisión con otro rol del tenant (excluyendo {@code excludeId}). */
    private String uniqueName(UUID tenantId, String rawName, Long excludeId) {
        String name = rawName.trim();
        if (repository.findByTenantIdAndNameIgnoreCase(tenantId, name).filter(r -> !r.getId().equals(excludeId)).isPresent()) {
            throw new DuplicateResourceException("Ya existe un rol con el nombre '" + name + "'");
        }
        return name;
    }

    private RoleResponse toResponse(UUID tenantId, Role role) {
        return new RoleResponse(role.getId(), role.getName(), role.getDescription(), role.isSystem(), role.isActive(),
                repository.findPermissionIds(tenantId, role.getId()).size(),
                repository.countUsers(tenantId, role.getId()));
    }

    private void grantPermissions(UUID tenantId, Long roleId, Set<Long> permissionIds) {
        var validIds = permissionRepository.findAllById(permissionIds).stream()
                .filter(Permission::isActive).map(Permission::getId).collect(Collectors.toSet());
        if (!validIds.equals(permissionIds)) {
            throw new IllegalArgumentException("Contiene permisos inválidos o inactivos");
        }
        repository.clearPermissions(tenantId, roleId);
        permissionIds.forEach(id -> repository.grantPermission(tenantId, roleId, id));
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
        grantPermissions(tenantId, roleId, permissionIds);
        return getRolePermissions(roleId);
    }
}
