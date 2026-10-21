package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: DocumentTag
 * Mapea la tabla relacional: document_tags
 */
public class DocumentTag {

    private UUID tenantId;
    private UUID documentId;
    private UUID tagId;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Document document;
    private Tag tag;

    public DocumentTag() {
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

    public UUID getTagId() {
        return this.tagId;
    }

    public void setTagId(UUID tagId) {
        this.tagId = tagId;
    }

    public Document getDocument() {
        return this.document;
    }

    public void setDocument(Document document) {
        this.document = document;
    }

    public Tag getTag() {
        return this.tag;
    }

    public void setTag(Tag tag) {
        this.tag = tag;
    }

}
