package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: UserGroupMember
 * Mapea la tabla relacional: user_group_members
 */
public class UserGroupMember {

    private UUID tenantId;
    private UUID groupId;
    private UUID userId;
    private Date joinedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private UserGroup group;
    private User user;

    public UserGroupMember() {
    }

    public UUID getTenantId() {
        return this.tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getGroupId() {
        return this.groupId;
    }

    public void setGroupId(UUID groupId) {
        this.groupId = groupId;
    }

    public UUID getUserId() {
        return this.userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public Date getJoinedAt() {
        return this.joinedAt;
    }

    public void setJoinedAt(Date joinedAt) {
        this.joinedAt = joinedAt;
    }

    public UserGroup getGroup() {
        return this.group;
    }

    public void setGroup(UserGroup group) {
        this.group = group;
    }

    public User getUser() {
        return this.user;
    }

    public void setUser(User user) {
        this.user = user;
    }

}
