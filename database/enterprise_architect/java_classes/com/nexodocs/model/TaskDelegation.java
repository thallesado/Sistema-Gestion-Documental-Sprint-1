package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: TaskDelegation
 * Mapea la tabla relacional: task_delegations
 */
public class TaskDelegation {

    private UUID id;
    private UUID tenantId;
    private UUID delegatorId;
    private UUID delegateId;
    private Date startsOn;
    private Date endsOn;
    private Boolean isActive;
    private Date createdAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private User delegator;
    private User delegate;

    public TaskDelegation() {
    }

    public UUID getId() {
        return this.id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTenantId() {
        return this.tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getDelegatorId() {
        return this.delegatorId;
    }

    public void setDelegatorId(UUID delegatorId) {
        this.delegatorId = delegatorId;
    }

    public UUID getDelegateId() {
        return this.delegateId;
    }

    public void setDelegateId(UUID delegateId) {
        this.delegateId = delegateId;
    }

    public Date getStartsOn() {
        return this.startsOn;
    }

    public void setStartsOn(Date startsOn) {
        this.startsOn = startsOn;
    }

    public Date getEndsOn() {
        return this.endsOn;
    }

    public void setEndsOn(Date endsOn) {
        this.endsOn = endsOn;
    }

    public Boolean getIsActive() {
        return this.isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Date getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public User getDelegator() {
        return this.delegator;
    }

    public void setDelegator(User delegator) {
        this.delegator = delegator;
    }

    public User getDelegate() {
        return this.delegate;
    }

    public void setDelegate(User delegate) {
        this.delegate = delegate;
    }

}
