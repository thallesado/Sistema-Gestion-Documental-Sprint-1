package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: MetadataDefinition
 * Mapea la tabla relacional: metadata_definitions
 */
public class MetadataDefinition {

    private UUID id;
    private UUID tenantId;
    private UUID documentTypeId;
    private String name;
    private String code;
    private String dataType;
    private String options;
    private Boolean isRequired;
    private Boolean isSearchable;
    private Integer sortOrder;
    private Date createdAt;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private DocumentType documentType;

    public MetadataDefinition() {
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

    public UUID getDocumentTypeId() {
        return this.documentTypeId;
    }

    public void setDocumentTypeId(UUID documentTypeId) {
        this.documentTypeId = documentTypeId;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return this.code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getDataType() {
        return this.dataType;
    }

    public void setDataType(String dataType) {
        this.dataType = dataType;
    }

    public String getOptions() {
        return this.options;
    }

    public void setOptions(String options) {
        this.options = options;
    }

    public Boolean getIsRequired() {
        return this.isRequired;
    }

    public void setIsRequired(Boolean isRequired) {
        this.isRequired = isRequired;
    }

    public Boolean getIsSearchable() {
        return this.isSearchable;
    }

    public void setIsSearchable(Boolean isSearchable) {
        this.isSearchable = isSearchable;
    }

    public Integer getSortOrder() {
        return this.sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
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

    public DocumentType getDocumentType() {
        return this.documentType;
    }

    public void setDocumentType(DocumentType documentType) {
        this.documentType = documentType;
    }

}
