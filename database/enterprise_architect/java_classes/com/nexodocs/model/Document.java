package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: Document
 * Mapea la tabla relacional: documents
 */
public class Document {

    private UUID id;
    private UUID tenantId;
    private UUID expedientId;
    private UUID documentTypeId;
    private UUID authorId;
    private UUID responsibleId;
    private UUID departmentId;
    private UUID patientId;
    private String code;
    private String name;
    private String description;
    private String status;
    private Integer currentVersion;
    private Boolean isExternalSource;
    private String source;
    private String specialty;
    private String institutionalProcess;
    private String metadata;
    private Date issueDate;
    private Date expiryDate;
    private Date archivedAt;
    private Date voidedAt;
    private Date deletedAt;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Expedient expedient;
    private DocumentType documentType;
    private User author;
    private User responsible;
    private TenantDepartment department;
    private Patient patient;

    public Document() {
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

    public UUID getExpedientId() {
        return this.expedientId;
    }

    public void setExpedientId(UUID expedientId) {
        this.expedientId = expedientId;
    }

    public UUID getDocumentTypeId() {
        return this.documentTypeId;
    }

    public void setDocumentTypeId(UUID documentTypeId) {
        this.documentTypeId = documentTypeId;
    }

    public UUID getAuthorId() {
        return this.authorId;
    }

    public void setAuthorId(UUID authorId) {
        this.authorId = authorId;
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

    public UUID getPatientId() {
        return this.patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
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

    public Integer getCurrentVersion() {
        return this.currentVersion;
    }

    public void setCurrentVersion(Integer currentVersion) {
        this.currentVersion = currentVersion;
    }

    public Boolean getIsExternalSource() {
        return this.isExternalSource;
    }

    public void setIsExternalSource(Boolean isExternalSource) {
        this.isExternalSource = isExternalSource;
    }

    public String getSource() {
        return this.source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getSpecialty() {
        return this.specialty;
    }

    public void setSpecialty(String specialty) {
        this.specialty = specialty;
    }

    public String getInstitutionalProcess() {
        return this.institutionalProcess;
    }

    public void setInstitutionalProcess(String institutionalProcess) {
        this.institutionalProcess = institutionalProcess;
    }

    public String getMetadata() {
        return this.metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Date getIssueDate() {
        return this.issueDate;
    }

    public void setIssueDate(Date issueDate) {
        this.issueDate = issueDate;
    }

    public Date getExpiryDate() {
        return this.expiryDate;
    }

    public void setExpiryDate(Date expiryDate) {
        this.expiryDate = expiryDate;
    }

    public Date getArchivedAt() {
        return this.archivedAt;
    }

    public void setArchivedAt(Date archivedAt) {
        this.archivedAt = archivedAt;
    }

    public Date getVoidedAt() {
        return this.voidedAt;
    }

    public void setVoidedAt(Date voidedAt) {
        this.voidedAt = voidedAt;
    }

    public Date getDeletedAt() {
        return this.deletedAt;
    }

    public void setDeletedAt(Date deletedAt) {
        this.deletedAt = deletedAt;
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

    public Expedient getExpedient() {
        return this.expedient;
    }

    public void setExpedient(Expedient expedient) {
        this.expedient = expedient;
    }

    public DocumentType getDocumentType() {
        return this.documentType;
    }

    public void setDocumentType(DocumentType documentType) {
        this.documentType = documentType;
    }

    public User getAuthor() {
        return this.author;
    }

    public void setAuthor(User author) {
        this.author = author;
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

    public Patient getPatient() {
        return this.patient;
    }

    public void setPatient(Patient patient) {
        this.patient = patient;
    }

}
