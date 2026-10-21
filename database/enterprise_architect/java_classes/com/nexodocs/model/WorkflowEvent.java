package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: WorkflowEvent
 * Mapea la tabla relacional: workflow_events
 */
public class WorkflowEvent {

    private UUID id;
    private UUID tenantId;
    private UUID workflowId;
    private UUID taskId;
    private UUID documentId;
    private String eventType;
    private UUID performedBy;
    private String result;
    private String comment;
    private String details;
    private Date performedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Workflow workflow;
    private WorkflowTask task;
    private Document document;
    private User users;

    public WorkflowEvent() {
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

    public UUID getWorkflowId() {
        return this.workflowId;
    }

    public void setWorkflowId(UUID workflowId) {
        this.workflowId = workflowId;
    }

    public UUID getTaskId() {
        return this.taskId;
    }

    public void setTaskId(UUID taskId) {
        this.taskId = taskId;
    }

    public UUID getDocumentId() {
        return this.documentId;
    }

    public void setDocumentId(UUID documentId) {
        this.documentId = documentId;
    }

    public String getEventType() {
        return this.eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public UUID getPerformedBy() {
        return this.performedBy;
    }

    public void setPerformedBy(UUID performedBy) {
        this.performedBy = performedBy;
    }

    public String getResult() {
        return this.result;
    }

    public void setResult(String result) {
        this.result = result;
    }

    public String getComment() {
        return this.comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getDetails() {
        return this.details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public Date getPerformedAt() {
        return this.performedAt;
    }

    public void setPerformedAt(Date performedAt) {
        this.performedAt = performedAt;
    }

    public Workflow getWorkflow() {
        return this.workflow;
    }

    public void setWorkflow(Workflow workflow) {
        this.workflow = workflow;
    }

    public WorkflowTask getTask() {
        return this.task;
    }

    public void setTask(WorkflowTask task) {
        this.task = task;
    }

    public Document getDocument() {
        return this.document;
    }

    public void setDocument(Document document) {
        this.document = document;
    }

    public User getUsers() {
        return this.users;
    }

    public void setUsers(User users) {
        this.users = users;
    }

}
