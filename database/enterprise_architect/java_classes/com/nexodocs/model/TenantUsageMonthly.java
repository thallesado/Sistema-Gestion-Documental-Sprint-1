package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: TenantUsageMonthly
 * Mapea la tabla relacional: tenant_usage_monthly
 */
public class TenantUsageMonthly {

    private UUID tenantId;
    private Date yearMonth;
    private Long apiCalls;
    private Long ocrPages;
    private Long documentsCreated;
    private Long storageBytes;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)

    public TenantUsageMonthly() {
    }

    public UUID getTenantId() {
        return this.tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public Date getYearMonth() {
        return this.yearMonth;
    }

    public void setYearMonth(Date yearMonth) {
        this.yearMonth = yearMonth;
    }

    public Long getApiCalls() {
        return this.apiCalls;
    }

    public void setApiCalls(Long apiCalls) {
        this.apiCalls = apiCalls;
    }

    public Long getOcrPages() {
        return this.ocrPages;
    }

    public void setOcrPages(Long ocrPages) {
        this.ocrPages = ocrPages;
    }

    public Long getDocumentsCreated() {
        return this.documentsCreated;
    }

    public void setDocumentsCreated(Long documentsCreated) {
        this.documentsCreated = documentsCreated;
    }

    public Long getStorageBytes() {
        return this.storageBytes;
    }

    public void setStorageBytes(Long storageBytes) {
        this.storageBytes = storageBytes;
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

}
