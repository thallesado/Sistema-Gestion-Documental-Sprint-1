package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: OcrJob
 * Mapea la tabla relacional: ocr_jobs
 */
public class OcrJob {

    private UUID id;
    private UUID tenantId;
    private UUID documentId;
    private UUID uploadedBy;
    private String status;
    private String originalFilePath;
    private String fileType;
    private Integer pagesTotal;
    private Integer pagesProcessed;
    private String rawText;
    private String extractedData;
    private String suggestedMetadata;
    private BigDecimal confidenceScore;
    private UUID validatedBy;
    private Date validatedAt;
    private String errorMessage;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Document document;
    private User users;
    private User users;

    public OcrJob() {
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

    public UUID getDocumentId() {
        return this.documentId;
    }

    public void setDocumentId(UUID documentId) {
        this.documentId = documentId;
    }

    public UUID getUploadedBy() {
        return this.uploadedBy;
    }

    public void setUploadedBy(UUID uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public String getStatus() {
        return this.status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOriginalFilePath() {
        return this.originalFilePath;
    }

    public void setOriginalFilePath(String originalFilePath) {
        this.originalFilePath = originalFilePath;
    }

    public String getFileType() {
        return this.fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public Integer getPagesTotal() {
        return this.pagesTotal;
    }

    public void setPagesTotal(Integer pagesTotal) {
        this.pagesTotal = pagesTotal;
    }

    public Integer getPagesProcessed() {
        return this.pagesProcessed;
    }

    public void setPagesProcessed(Integer pagesProcessed) {
        this.pagesProcessed = pagesProcessed;
    }

    public String getRawText() {
        return this.rawText;
    }

    public void setRawText(String rawText) {
        this.rawText = rawText;
    }

    public String getExtractedData() {
        return this.extractedData;
    }

    public void setExtractedData(String extractedData) {
        this.extractedData = extractedData;
    }

    public String getSuggestedMetadata() {
        return this.suggestedMetadata;
    }

    public void setSuggestedMetadata(String suggestedMetadata) {
        this.suggestedMetadata = suggestedMetadata;
    }

    public BigDecimal getConfidenceScore() {
        return this.confidenceScore;
    }

    public void setConfidenceScore(BigDecimal confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public UUID getValidatedBy() {
        return this.validatedBy;
    }

    public void setValidatedBy(UUID validatedBy) {
        this.validatedBy = validatedBy;
    }

    public Date getValidatedAt() {
        return this.validatedAt;
    }

    public void setValidatedAt(Date validatedAt) {
        this.validatedAt = validatedAt;
    }

    public String getErrorMessage() {
        return this.errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
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

    public User getUsers() {
        return this.users;
    }

    public void setUsers(User users) {
        this.users = users;
    }

}
