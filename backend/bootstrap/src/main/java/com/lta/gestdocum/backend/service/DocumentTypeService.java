package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentTypeRequest;
import com.lta.gestdocum.backend.dto.DocumentTypeResponse;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.DocumentType;
import com.lta.gestdocum.backend.repository.DocumentTypeRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class DocumentTypeService {

    private final DocumentTypeRepository repository;
    private final AuthenticatedUserContext userContext;

    public DocumentTypeService(
            DocumentTypeRepository repository,
            AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<DocumentTypeResponse> find(String filter, Boolean active, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String normalizedFilter = filter == null ? "" : filter.trim();
        return repository.findByTenant(tenantId, normalizedFilter, active, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public DocumentTypeResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        return toResponse(getForTenant(id));
    }

    @Transactional
    public DocumentTypeResponse create(DocumentTypeRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String name = CrudTextSupport.required(request.getName(), "name");
        String code = CrudTextSupport.required(request.getCode(), "code");
        ensureUnique(tenantId, code, name, null);

        OffsetDateTime now = OffsetDateTime.now();
        DocumentType documentType = DocumentType.builder()
                .tenantId(tenantId)
                .name(name)
                .code(code)
                .description(trimToNull(request.getDescription()))
                .categoryId(request.getCategoryId())
                .retentionPolicyId(request.getRetentionPolicyId())
                .workflowTemplateId(request.getWorkflowTemplateId())
                .metadataSchema(request.getMetadataSchema() == null ? Map.of() : request.getMetadataSchema())
                .active(request.getActive() == null || request.getActive())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(documentType));
    }

    @Transactional
    public DocumentTypeResponse update(UUID id, DocumentTypeRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        DocumentType documentType = getForTenant(id);
        String name = request.getName() == null
                ? documentType.getName()
                : CrudTextSupport.required(request.getName(), "name");
        String code = request.getCode() == null
                ? documentType.getCode()
                : CrudTextSupport.required(request.getCode(), "code");
        ensureUnique(tenantId, code, name, id);

        documentType.setName(name);
        documentType.setCode(code);
        if (request.getDescription() != null) {
            documentType.setDescription(trimToNull(request.getDescription()));
        }
        if (request.getCategoryId() != null) {
            documentType.setCategoryId(request.getCategoryId());
        }
        if (request.getRetentionPolicyId() != null) {
            documentType.setRetentionPolicyId(request.getRetentionPolicyId());
        }
        if (request.getWorkflowTemplateId() != null) {
            documentType.setWorkflowTemplateId(request.getWorkflowTemplateId());
        }
        if (request.getMetadataSchema() != null) {
            documentType.setMetadataSchema(request.getMetadataSchema());
        }
        if (request.getActive() != null) {
            documentType.setActive(request.getActive());
        }
        documentType.setUpdatedAt(OffsetDateTime.now());
        return toResponse(repository.save(documentType));
    }

    @Transactional
    public void deactivate(UUID id) {
        userContext.establishDatabaseContext();
        DocumentType documentType = getForTenant(id);
        documentType.setActive(false);
        documentType.setUpdatedAt(OffsetDateTime.now());
        repository.save(documentType);
    }

    private DocumentType getForTenant(UUID id) {
        return repository.findByIdAndTenantId(id, userContext.requireTenantId())
                .orElseThrow(() -> new NotFoundException("Tipo documental no encontrado"));
    }

    private void ensureUnique(UUID tenantId, String code, String name, UUID excludedId) {
        if (repository.existsDuplicate(tenantId, code, name, excludedId)) {
            throw new DuplicateResourceException("El código o nombre del tipo documental ya existe");
        }
    }

    private DocumentTypeResponse toResponse(DocumentType documentType) {
        return DocumentTypeResponse.builder()
                .id(documentType.getId())
                .categoryId(documentType.getCategoryId())
                .retentionPolicyId(documentType.getRetentionPolicyId())
                .workflowTemplateId(documentType.getWorkflowTemplateId())
                .name(documentType.getName())
                .code(documentType.getCode())
                .description(documentType.getDescription())
                .metadataSchema(documentType.getMetadataSchema())
                .active(documentType.isActive())
                .createdAt(documentType.getCreatedAt())
                .updatedAt(documentType.getUpdatedAt())
                .build();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
