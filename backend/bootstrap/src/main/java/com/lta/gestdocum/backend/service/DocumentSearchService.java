package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentDTO;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

@Component
public class DocumentSearchService {

    private final DocumentRepository documentRepository;
    private final AuthenticatedUserContext authenticatedUserContext;

    private final ComponentPermissionService componentPermissions;

    public DocumentSearchService(DocumentRepository documentRepository, AuthenticatedUserContext authenticatedUserContext,
                                 ComponentPermissionService componentPermissions) {
        this.documentRepository = documentRepository;
        this.authenticatedUserContext = authenticatedUserContext;
        this.componentPermissions = componentPermissions;
    }

    public List<DocumentDTO> searchDocumentsByTenant(String query, int limit) {
        UUID tenantId = authenticatedUserContext.requireTenantId();

        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }

        // B2: no se puede buscar por un nombre que el perfil no ve (inferencia) ni devolver campos ocultos.
        ComponentFormAccess access = componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM);
        if (!access.visible("nombre")) {
            return List.of();
        }

        List<Document> documents = documentRepository
            .findByTenantIdAndNameContainingIgnoreCase(tenantId, query)
            .stream()
            .limit(limit)
            .toList();

        return documents.stream()
            .map(document -> mapToDocumentDTO(document, access))
            .toList();
    }

    private DocumentDTO mapToDocumentDTO(Document doc, ComponentFormAccess access) {
        double relevance = 0.8;
        return new DocumentDTO(
            doc.getId().toString(),
            access.reveal("codigo", doc.getCode()),
            access.reveal("nombre", doc.getName()),
            access.reveal("descripcion", doc.getDescription()),
            "Documento",
            relevance
        );
    }

    public String buildRAGContext(List<DocumentDTO> documents) {
        if (documents == null || documents.isEmpty()) {
            return "";
        }

        StringBuilder context = new StringBuilder();
        context.append("Documentos relevantes del sistema:\n\n");

        for (DocumentDTO doc : documents) {
            context.append("- Documento: ").append(doc.getTitle()).append("\n");
            context.append("  Código: ").append(doc.getDocumentNumber()).append("\n");
            context.append("  Descripción: ").append(doc.getDescription()).append("\n");
            context.append("  Relevancia: ").append(String.format("%.0f%%", doc.getRelevance() * 100)).append("\n\n");
        }

        return context.toString();
    }
}
