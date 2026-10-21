package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: WorkflowTemplateStage
 * Mapea la tabla relacional: workflow_template_stages
 */
public class WorkflowTemplateStage {

    private UUID id;
    private UUID tenantId;
    private UUID workflowTemplateId;
    private String name;
    private String stageType;
    private Integer sortOrder;
    private String assignmentType;
    private String assignmentReference;
    private Integer dueDays;
    private String rules;

    // Relaciones de asociacion UML (Claves Foraneas)
    private WorkflowTemplate workflowTemplate;

    public WorkflowTemplateStage() {
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

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStageType() {
        return this.stageType;
    }

    public void setStageType(String stageType) {
        this.stageType = stageType;
    }

    public Integer getSortOrder() {
        return this.sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getAssignmentType() {
        return this.assignmentType;
    }

    public void setAssignmentType(String assignmentType) {
        this.assignmentType = assignmentType;
    }

    public String getAssignmentReference() {
        return this.assignmentReference;
    }

    public void setAssignmentReference(String assignmentReference) {
        this.assignmentReference = assignmentReference;
    }

    public Integer getDueDays() {
        return this.dueDays;
    }

    public void setDueDays(Integer dueDays) {
        this.dueDays = dueDays;
    }

    public String getRules() {
        return this.rules;
    }

    public void setRules(String rules) {
        this.rules = rules;
    }

    public WorkflowTemplate getWorkflowTemplate() {
        return this.workflowTemplate;
    }

    public void setWorkflowTemplate(WorkflowTemplate workflowTemplate) {
        this.workflowTemplate = workflowTemplate;
    }

}
