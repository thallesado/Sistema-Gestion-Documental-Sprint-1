package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: DocumentType
 * Mapea la tabla relacional: document_types
 */
public class DocumentType {

    private UUID id;
    private UUID tenantId;
    private UUID categoryId;
    private UUID retentionPolicyId;
    private UUID workflowTemplateId;
    private String name;
    private String code;
    private String description;
    private String metadataSchema;
    private Boolean isActive;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private DocumentCategory category;
    private RetentionPolicy retentionPolicy;
    private WorkflowTemplate workflowTemplate;

    public DocumentType() {
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

    public UUID getCategoryId() {
        return this.categoryId;
    }

    public void setCategoryId(UUID categoryId) {
        this.categoryId = categoryId;
    }

    public UUID getRetentionPolicyId() {
        return this.retentionPolicyId;
    }

    public void setRetentionPolicyId(UUID retentionPolicyId) {
        this.retentionPolicyId = retentionPolicyId;
    }

    public UUID getWorkflowTemplateId() {
        return this.workflowTemplateId;
    }

    public void setWorkflowTemplateId(UUID workflowTemplateId) {
        this.workflowTemplateId = workflowTemplateId;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return this.code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getDescription() {
        return this.description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getMetadataSchema() {
        return this.metadataSchema;
    }

    public void setMetadataSchema(String metadataSchema) {
        this.metadataSchema = metadataSchema;
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

    public Date getUpdatedAt() {
        return this.updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Tenant getTenant() {
        return this.tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public DocumentCategory getCategory() {
        return this.category;
    }

    public void setCategory(DocumentCategory category) {
        this.category = category;
    }

    public RetentionPolicy getRetentionPolicy() {
        return this.retentionPolicy;
    }

    public void setRetentionPolicy(RetentionPolicy retentionPolicy) {
        this.retentionPolicy = retentionPolicy;
    }

    public WorkflowTemplate getWorkflowTemplate() {
        return this.workflowTemplate;
    }

    public void setWorkflowTemplate(WorkflowTemplate workflowTemplate) {
        this.workflowTemplate = workflowTemplate;
    }

}
