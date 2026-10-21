package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: DocumentMetadataValue
 * Mapea la tabla relacional: document_metadata_values
 */
public class DocumentMetadataValue {

    private UUID tenantId;
    private UUID documentId;
    private UUID metadataDefinitionId;
    private String value;
    private UUID updatedBy;
    private Date updatedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Document document;
    private MetadataDefinition metadataDefinition;
    private User users;

    public DocumentMetadataValue() {
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

    public UUID getMetadataDefinitionId() {
        return this.metadataDefinitionId;
    }

    public void setMetadataDefinitionId(UUID metadataDefinitionId) {
        this.metadataDefinitionId = metadataDefinitionId;
    }

    public String getValue() {
        return this.value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public UUID getUpdatedBy() {
        return this.updatedBy;
    }

    public void setUpdatedBy(UUID updatedBy) {
        this.updatedBy = updatedBy;
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

    public MetadataDefinition getMetadataDefinition() {
        return this.metadataDefinition;
    }

    public void setMetadataDefinition(MetadataDefinition metadataDefinition) {
        this.metadataDefinition = metadataDefinition;
    }

    public User getUsers() {
        return this.users;
    }

    public void setUsers(User users) {
        this.users = users;
    }

}
