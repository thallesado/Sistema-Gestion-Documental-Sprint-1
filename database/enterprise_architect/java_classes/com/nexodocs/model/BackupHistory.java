package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: BackupHistory
 * Mapea la tabla relacional: backup_history
 */
public class BackupHistory {

    private UUID id;
    private UUID tenantId;
    private String backupType;
    private String status;
    private UUID createdBy;
    private String filePath;
    private Long fileSizeBytes;
    private Date createdAt;
    private Date completedAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private User users;

    public BackupHistory() {
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

    public String getBackupType() {
        return this.backupType;
    }

    public void setBackupType(String backupType) {
        this.backupType = backupType;
    }

    public String getStatus() {
        return this.status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getCreatedBy() {
        return this.createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
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

    public Date getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getCompletedAt() {
        return this.completedAt;
    }

    public void setCompletedAt(Date completedAt) {
        this.completedAt = completedAt;
    }

    public Date getUpdatedAt() {
        return this.updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }

    public User getUsers() {
        return this.users;
    }

    public void setUsers(User users) {
        this.users = users;
    }

}
