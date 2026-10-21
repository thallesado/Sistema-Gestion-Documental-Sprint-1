package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: DicomInstance
 * Mapea la tabla relacional: dicom_instances
 */
public class DicomInstance {

    private UUID id;
    private UUID tenantId;
    private UUID seriesId;
    private String sopInstanceUid;
    private Integer instanceNumber;
    private String filePath;
    private Long fileSizeBytes;
    private Integer rowsCount;
    private Integer columnsCount;
    private Integer bitsAllocated;
    private BigDecimal windowCenter;
    private BigDecimal windowWidth;
    private String pixelSpacing;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private DicomSeries series;

    public DicomInstance() {
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

    public UUID getSeriesId() {
        return this.seriesId;
    }

    public void setSeriesId(UUID seriesId) {
        this.seriesId = seriesId;
    }

    public String getSopInstanceUid() {
        return this.sopInstanceUid;
    }

    public void setSopInstanceUid(String sopInstanceUid) {
        this.sopInstanceUid = sopInstanceUid;
    }

    public Integer getInstanceNumber() {
        return this.instanceNumber;
    }

    public void setInstanceNumber(Integer instanceNumber) {
        this.instanceNumber = instanceNumber;
    }

    public String getFilePath() {
        return this.filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public Long getFileSizeBytes() {
        return this.fileSizeBytes;
    }

    public void setFileSizeBytes(Long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public Integer getRowsCount() {
        return this.rowsCount;
    }

    public void setRowsCount(Integer rowsCount) {
        this.rowsCount = rowsCount;
    }

    public Integer getColumnsCount() {
        return this.columnsCount;
    }

    public void setColumnsCount(Integer columnsCount) {
        this.columnsCount = columnsCount;
    }

    public Integer getBitsAllocated() {
        return this.bitsAllocated;
    }

    public void setBitsAllocated(Integer bitsAllocated) {
        this.bitsAllocated = bitsAllocated;
    }

    public BigDecimal getWindowCenter() {
        return this.windowCenter;
    }

    public void setWindowCenter(BigDecimal windowCenter) {
        this.windowCenter = windowCenter;
    }

    public BigDecimal getWindowWidth() {
        return this.windowWidth;
    }

    public void setWindowWidth(BigDecimal windowWidth) {
        this.windowWidth = windowWidth;
    }

    public String getPixelSpacing() {
        return this.pixelSpacing;
    }

    public void setPixelSpacing(String pixelSpacing) {
        this.pixelSpacing = pixelSpacing;
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

    public DicomSeries getSeries() {
        return this.series;
    }

    public void setSeries(DicomSeries series) {
        this.series = series;
    }

}
