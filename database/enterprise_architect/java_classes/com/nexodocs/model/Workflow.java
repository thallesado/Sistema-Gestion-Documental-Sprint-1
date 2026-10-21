package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: Workflow
 * Mapea la tabla relacional: workflows
 */
public class Workflow {

    private UUID id;
    private UUID tenantId;
    private UUID workflowTemplateId;
    private UUID expedientId;
    private String title;
    private String description;
    private String status;
    private Short priority;
    private UUID creatorId;
    private UUID currentStageId;
    private Date startedAt;
    private Date dueAt;
    private Date completedAt;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private WorkflowTemplate workflowTemplate;
    private Expedient expedient;
    private User creator;
    private WorkflowTemplateStage currentStage;

    public Workflow() {
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

    public UUID getWorkflowTemplateId() {
        return this.workflowTemplateId;
    }

    public void setWorkflowTemplateId(UUID workflowTemplateId) {
        this.workflowTemplateId = workflowTemplateId;
    }

    public UUID getExpedientId() {
        return this.expedientId;
    }

    public void setExpedientId(UUID expedientId) {
        this.expedientId = expedientId;
    }

    public String getTitle() {
        return this.title;
    }

    public void setTitle(String title) {
        this.title = title;
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

    public Short getPriority() {
        return this.priority;
    }

    public void setPriority(Short priority) {
        this.priority = priority;
    }

    public UUID getCreatorId() {
        return this.creatorId;
    }

    public void setCreatorId(UUID creatorId) {
        this.creatorId = creatorId;
    }

    public UUID getCurrentStageId() {
        return this.currentStageId;
    }

    public void setCurrentStageId(UUID currentStageId) {
        this.currentStageId = currentStageId;
    }

    public Date getStartedAt() {
        return this.startedAt;
    }

    public void setStartedAt(Date startedAt) {
        this.startedAt = startedAt;
    }

    public Date getDueAt() {
        return this.dueAt;
    }

    public void setDueAt(Date dueAt) {
        this.dueAt = dueAt;
    }

    public Date getCompletedAt() {
        return this.completedAt;
    }

    public void setCompletedAt(Date completedAt) {
        this.completedAt = completedAt;
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

    public WorkflowTemplate getWorkflowTemplate() {
        return this.workflowTemplate;
    }

    public void setWorkflowTemplate(WorkflowTemplate workflowTemplate) {
        this.workflowTemplate = workflowTemplate;
    }

    public Expedient getExpedient() {
        return this.expedient;
    }

    public void setExpedient(Expedient expedient) {
        this.expedient = expedient;
    }

    public User getCreator() {
        return this.creator;
    }

    public void setCreator(User creator) {
        this.creator = creator;
    }

    public WorkflowTemplateStage getCurrentStage() {
        return this.currentStage;
    }

    public void setCurrentStage(WorkflowTemplateStage currentStage) {
        this.currentStage = currentStage;
    }

}
