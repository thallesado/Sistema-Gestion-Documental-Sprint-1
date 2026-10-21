package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: WorkflowTask
 * Mapea la tabla relacional: workflow_tasks
 */
public class WorkflowTask {

    private UUID id;
    private UUID tenantId;
    private UUID workflowId;
    private UUID stageId;
    private UUID documentId;
    private String title;
    private String description;
    private UUID assignedUserId;
    private Long assignedRoleId;
    private UUID assignedDepartmentId;
    private UUID assignedGroupId;
    private String status;
    private String outcome;
    private Short priority;
    private Integer documentVersion;
    private Date dueAt;
    private Date startedAt;
    private Date completedAt;
    private UUID completedBy;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Workflow workflow;
    private WorkflowTemplateStage stage;
    private Document document;
    private User assignedUser;
    private Role assignedRole;
    private TenantDepartment assignedDepartment;
    private UserGroup assignedGroup;
    private User users;

    public WorkflowTask() {
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

    public UUID getStageId() {
        return this.stageId;
    }

    public void setStageId(UUID stageId) {
        this.stageId = stageId;
    }

    public UUID getDocumentId() {
        return this.documentId;
    }

    public void setDocumentId(UUID documentId) {
        this.documentId = documentId;
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

    public UUID getAssignedUserId() {
        return this.assignedUserId;
    }

    public void setAssignedUserId(UUID assignedUserId) {
        this.assignedUserId = assignedUserId;
    }

    public Long getAssignedRoleId() {
        return this.assignedRoleId;
    }

    public void setAssignedRoleId(Long assignedRoleId) {
        this.assignedRoleId = assignedRoleId;
    }

    public UUID getAssignedDepartmentId() {
        return this.assignedDepartmentId;
    }

    public void setAssignedDepartmentId(UUID assignedDepartmentId) {
        this.assignedDepartmentId = assignedDepartmentId;
    }

    public UUID getAssignedGroupId() {
        return this.assignedGroupId;
    }

    public void setAssignedGroupId(UUID assignedGroupId) {
        this.assignedGroupId = assignedGroupId;
    }

    public String getStatus() {
        return this.status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOutcome() {
        return this.outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public Short getPriority() {
        return this.priority;
    }

    public void setPriority(Short priority) {
        this.priority = priority;
    }

    public Integer getDocumentVersion() {
        return this.documentVersion;
    }

    public void setDocumentVersion(Integer documentVersion) {
        this.documentVersion = documentVersion;
    }

    public Date getDueAt() {
        return this.dueAt;
    }

    public void setDueAt(Date dueAt) {
        this.dueAt = dueAt;
    }

    public Date getStartedAt() {
        return this.startedAt;
    }

    public void setStartedAt(Date startedAt) {
        this.startedAt = startedAt;
    }

    public Date getCompletedAt() {
        return this.completedAt;
    }

    public void setCompletedAt(Date completedAt) {
        this.completedAt = completedAt;
    }

    public UUID getCompletedBy() {
        return this.completedBy;
    }

    public void setCompletedBy(UUID completedBy) {
        this.completedBy = completedBy;
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

    public Workflow getWorkflow() {
        return this.workflow;
    }

    public void setWorkflow(Workflow workflow) {
        this.workflow = workflow;
    }

    public WorkflowTemplateStage getStage() {
        return this.stage;
    }

    public void setStage(WorkflowTemplateStage stage) {
        this.stage = stage;
    }

    public Document getDocument() {
        return this.document;
    }

    public void setDocument(Document document) {
        this.document = document;
    }

    public User getAssignedUser() {
        return this.assignedUser;
    }

    public void setAssignedUser(User assignedUser) {
        this.assignedUser = assignedUser;
    }

    public Role getAssignedRole() {
        return this.assignedRole;
    }

    public void setAssignedRole(Role assignedRole) {
        this.assignedRole = assignedRole;
    }

    public TenantDepartment getAssignedDepartment() {
        return this.assignedDepartment;
    }

    public void setAssignedDepartment(TenantDepartment assignedDepartment) {
        this.assignedDepartment = assignedDepartment;
    }

    public UserGroup getAssignedGroup() {
        return this.assignedGroup;
    }

    public void setAssignedGroup(UserGroup assignedGroup) {
        this.assignedGroup = assignedGroup;
    }

    public User getUsers() {
        return this.users;
    }

    public void setUsers(User users) {
        this.users = users;
    }

}
