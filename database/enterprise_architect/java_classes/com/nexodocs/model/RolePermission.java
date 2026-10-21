package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: RolePermission
 * Mapea la tabla relacional: role_permissions
 */
public class RolePermission {

    private UUID tenantId;
    private Long roleId;
    private Long permissionId;
    private Date grantedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Role role;
    private Permission permission;

    public RolePermission() {
    }

    public UUID getTenantId() {
        return this.tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public Long getRoleId() {
        return this.roleId;
    }

    public void setRoleId(Long roleId) {
        this.roleId = roleId;
    }

    public Long getPermissionId() {
        return this.permissionId;
    }

    public void setPermissionId(Long permissionId) {
        this.permissionId = permissionId;
    }

    public Date getGrantedAt() {
        return this.grantedAt;
    }

    public void setGrantedAt(Date grantedAt) {
        this.grantedAt = grantedAt;
    }

    public Role getRole() {
        return this.role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public Permission getPermission() {
        return this.permission;
    }

    public void setPermission(Permission permission) {
        this.permission = permission;
    }

}
