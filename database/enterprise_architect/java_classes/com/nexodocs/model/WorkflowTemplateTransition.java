package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: WorkflowTemplateTransition
 * Mapea la tabla relacional: workflow_template_transitions
 */
public class WorkflowTemplateTransition {

    private UUID id;
    private UUID tenantId;
    private UUID workflowTemplateId;
    private UUID fromStageId;
    private UUID toStageId;
    private String name;
    private String condition;

    // Relaciones de asociacion UML (Claves Foraneas)
    private WorkflowTemplate workflowTemplate;
    private WorkflowTemplateStage fromStage;
    private WorkflowTemplateStage toStage;

    public WorkflowTemplateTransition() {
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

    public UUID getFromStageId() {
        return this.fromStageId;
    }

    public void setFromStageId(UUID fromStageId) {
        this.fromStageId = fromStageId;
    }

    public UUID getToStageId() {
        return this.toStageId;
    }

    public void setToStageId(UUID toStageId) {
        this.toStageId = toStageId;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCondition() {
        return this.condition;
    }

    public void setCondition(String condition) {
        this.condition = condition;
    }

    public WorkflowTemplate getWorkflowTemplate() {
        return this.workflowTemplate;
    }

    public void setWorkflowTemplate(WorkflowTemplate workflowTemplate) {
        this.workflowTemplate = workflowTemplate;
    }

    public WorkflowTemplateStage getFromStage() {
        return this.fromStage;
    }

    public void setFromStage(WorkflowTemplateStage fromStage) {
        this.fromStage = fromStage;
    }

    public WorkflowTemplateStage getToStage() {
        return this.toStage;
    }

    public void setToStage(WorkflowTemplateStage toStage) {
        this.toStage = toStage;
    }

}
