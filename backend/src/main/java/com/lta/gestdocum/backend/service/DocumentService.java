package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.dto.DocumentStatusRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class DocumentService {
    private final DocumentRepository repository;
    private final AuthenticatedUserContext userContext;

    public DocumentService(DocumentRepository repository, AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<DocumentResponse> find(String filter, Document.DocumentStatus status, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String value = filter == null ? "" : filter.trim();
        if (status != null) {
            return repository.searchByTenantAndStatus(tenantId, value, status, pageable).map(this::toResponse);
        }
        return repository.searchByTenant(tenantId, value, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<DocumentResponse> findMine(String filter, Document.DocumentStatus status, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        UUID userId = userContext.requireUserId();
        userContext.establishDatabaseContext();
        String value = filter == null ? "" : filter.trim();
        return repository.searchMine(tenantId, userId, value, status, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public DocumentResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        return toResponse(getForTenant(id));
    }

    @Transactional
    public DocumentResponse create(DocumentCreateRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        Document document = new Document(tenantId, request.documentTypeId(),
                userContext.requireUserId(), request.code().trim(), request.name().trim());
        document.setId(UUID.randomUUID());
        document.setExpedientId(request.expedientId());
        document.setResponsibleId(request.responsibleId());
        document.setDepartmentId(request.departmentId());
        document.setDescription(blankToNull(request.description()));
        document.setIssueDate(request.issueDate());
        document.setExpiryDate(request.expiryDate());
        document.setIsExternalSource(Boolean.TRUE.equals(request.externalSource()));
        document.setSource(blankToNull(request.source()));
        OffsetDateTime now = OffsetDateTime.now();
        document.setCreatedAt(now);
        document.setUpdatedAt(now);
        try {
            return toResponse(repository.save(document));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException("El código de documento ya existe o referencia datos inválidos");
        }
    }

    @Transactional
    public DocumentResponse changeStatus(UUID id, DocumentStatusRequest request) {
        userContext.establishDatabaseContext();
        Document document = getForTenant(id);
        if (!isAllowedTransition(document.getStatus(), request.status())) {
            throw new IllegalArgumentException("Transición documental no permitida: "
                    + document.getStatus() + " -> " + request.status());
        }
        document.setStatus(request.status());
        document.setUpdatedAt(OffsetDateTime.now());
        return toResponse(repository.save(document));
    }

    private Document getForTenant(UUID id) {
        return repository.findByIdAndTenantIdAndDeletedAtIsNull(id, userContext.requireTenantId())
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
    }

    private DocumentResponse toResponse(Document document) {
        return new DocumentResponse(document.getId(), document.getDocumentTypeId(), document.getExpedientId(),
                document.getAuthorId(), document.getResponsibleId(), document.getDepartmentId(), document.getCode(),
                document.getName(), document.getDescription(), document.getStatus(), document.getCurrentVersion(),
                document.getIssueDate(), document.getExpiryDate(), document.getIsExternalSource(), document.getSource(),
                document.getCreatedAt(), document.getUpdatedAt());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isAllowedTransition(Document.DocumentStatus current, Document.DocumentStatus target) {
        if (current == target) return true;
        return switch (current) {
            case DRAFT -> target == Document.DocumentStatus.PENDING || target == Document.DocumentStatus.TRASHED;
            case PENDING -> target == Document.DocumentStatus.IN_REVIEW || target == Document.DocumentStatus.REJECTED;
            case IN_REVIEW -> target == Document.DocumentStatus.APPROVED || target == Document.DocumentStatus.REJECTED;
            case REJECTED -> target == Document.DocumentStatus.DRAFT || target == Document.DocumentStatus.TRASHED;
            case APPROVED -> target == Document.DocumentStatus.CURRENT || target == Document.DocumentStatus.ARCHIVED;
            case CURRENT -> target == Document.DocumentStatus.ARCHIVED || target == Document.DocumentStatus.VOIDED;
            case ARCHIVED -> target == Document.DocumentStatus.CURRENT;
            case VOIDED, TRASHED -> false;
        };
    }
}
