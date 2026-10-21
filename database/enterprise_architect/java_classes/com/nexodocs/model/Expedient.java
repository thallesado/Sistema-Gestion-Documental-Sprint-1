package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: Expedient
 * Mapea la tabla relacional: expedients
 */
public class Expedient {

    private UUID id;
    private UUID tenantId;
    private UUID expedientTypeId;
    private UUID responsibleId;
    private UUID departmentId;
    private String code;
    private String name;
    private String description;
    private String status;
    private String metadata;
    private Date closedAt;
    private Date archivedAt;
    private Date createdAt;
    private Date updatedAt;
    private Date deletedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private ExpedientType expedientType;
    private User responsible;
    private TenantDepartment department;

    public Expedient() {
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

    public UUID getExpedientTypeId() {
        return this.expedientTypeId;
    }

    public void setExpedientTypeId(UUID expedientTypeId) {
        this.expedientTypeId = expedientTypeId;
    }

    public UUID getResponsibleId() {
        return this.responsibleId;
    }

    public void setResponsibleId(UUID responsibleId) {
        this.responsibleId = responsibleId;
    }

    public UUID getDepartmentId() {
        return this.departmentId;
    }

    public void setDepartmentId(UUID departmentId) {
        this.departmentId = departmentId;
    }

    public String getCode() {
        return this.code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return this.description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return this.status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMetadata() {
        return this.metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Date getClosedAt() {
        return this.closedAt;
    }

    public void setClosedAt(Date closedAt) {
        this.closedAt = closedAt;
    }

    public Date getArchivedAt() {
        return this.archivedAt;
    }

    public void setArchivedAt(Date archivedAt) {
        this.archivedAt = archivedAt;
    }

    public Date getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return this.updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Date getDeletedAt() {
        return this.deletedAt;
    }

    public void setDeletedAt(Date deletedAt) {
        this.deletedAt = deletedAt;
    }

    public Tenant getTenant() {
        return this.tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public ExpedientType getExpedientType() {
        return this.expedientType;
    }

    public void setExpedientType(ExpedientType expedientType) {
        this.expedientType = expedientType;
    }

    public User getResponsible() {
        return this.responsible;
    }

    public void setResponsible(User responsible) {
        this.responsible = responsible;
    }

    public TenantDepartment getDepartment() {
        return this.department;
    }

    public void setDepartment(TenantDepartment department) {
        this.department = department;
    }

}
