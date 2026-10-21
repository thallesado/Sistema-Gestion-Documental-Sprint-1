package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Una ejecución de OCR sobre un archivo: guarda el archivo, el resultado de la
 * extracción y la decisión del revisor. Es la fuente de las métricas de digitalización.
 */
@Entity
@Table(name = "ocr_jobs")
public class OcrJob {

    public enum Status { QUEUED, PROCESSING, REQUIRES_VALIDATION, VALIDATED, INDEXED, FAILED, REJECTED }

    @Id
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "uploaded_by", nullable = false)
    private UUID uploadedBy;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "ocr_status")
    private Status status = Status.PROCESSING;

    @Column(name = "original_file_path", nullable = false, columnDefinition = "text")
    private String originalFilePath;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "file_type", length = 30)
    private String fileType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "pages_total")
    private Integer pagesTotal;

    @Column(name = "pages_processed", nullable = false)
    private Integer pagesProcessed = 0;

    @Column(name = "raw_text", columnDefinition = "text")
    private String rawText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extracted_data", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> extractedData = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "suggested_metadata", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> suggestedMetadata = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "final_metadata", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> finalMetadata = new HashMap<>();

    @Column(name = "confidence_score", precision = 5, scale = 4)
    private BigDecimal confidenceScore;

    @Column(name = "model_used", length = 100)
    private String modelUsed;

    @Column(name = "processing_ms")
    private Integer processingMs;

    @Column(name = "validated_by")
    private UUID validatedBy;

    @Column(name = "validated_at")
    private OffsetDateTime validatedAt;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public OcrJob() {
    }

    public OcrJob(UUID id, UUID tenantId, UUID uploadedBy, String originalFilePath) {
        this.id = id;
        this.tenantId = tenantId;
        this.uploadedBy = uploadedBy;
        this.originalFilePath = originalFilePath;
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID getId() { return id; }
    public UUID getTenantId() { return tenantId; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public UUID getUploadedBy() { return uploadedBy; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getOriginalFilePath() { return originalFilePath; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }
    public Long getFileSizeBytes() { return fileSizeBytes; }
    public void setFileSizeBytes(Long fileSizeBytes) { this.fileSizeBytes = fileSizeBytes; }
    public Integer getPagesTotal() { return pagesTotal; }
    public void setPagesTotal(Integer pagesTotal) { this.pagesTotal = pagesTotal; }
    public Integer getPagesProcessed() { return pagesProcessed; }
    public void setPagesProcessed(Integer pagesProcessed) { this.pagesProcessed = pagesProcessed; }
    public String getRawText() { return rawText; }
    public void setRawText(String rawText) { this.rawText = rawText; }
    public Map<String, Object> getExtractedData() { return extractedData; }
    public void setExtractedData(Map<String, Object> extractedData) { this.extractedData = extractedData; }
    public Map<String, Object> getSuggestedMetadata() { return suggestedMetadata; }
    public void setSuggestedMetadata(Map<String, Object> suggestedMetadata) { this.suggestedMetadata = suggestedMetadata; }
    public Map<String, Object> getFinalMetadata() { return finalMetadata; }
    public void setFinalMetadata(Map<String, Object> finalMetadata) { this.finalMetadata = finalMetadata; }
    public BigDecimal getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(BigDecimal confidenceScore) { this.confidenceScore = confidenceScore; }
    public String getModelUsed() { return modelUsed; }
    public void setModelUsed(String modelUsed) { this.modelUsed = modelUsed; }
    public Integer getProcessingMs() { return processingMs; }
    public void setProcessingMs(Integer processingMs) { this.processingMs = processingMs; }
    public UUID getValidatedBy() { return validatedBy; }
    public void setValidatedBy(UUID validatedBy) { this.validatedBy = validatedBy; }
    public OffsetDateTime getValidatedAt() { return validatedAt; }
    public void setValidatedAt(OffsetDateTime validatedAt) { this.validatedAt = validatedAt; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
