package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.dto.DocumentStatusRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.model.DocumentCategory;
import com.lta.gestdocum.backend.model.DocumentType;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.model.TenantDepartment;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.DocumentCategoryRepository;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.DocumentTypeRepository;
import com.lta.gestdocum.backend.repository.ExpedientRepository;
import com.lta.gestdocum.backend.repository.PatientRepository;
import com.lta.gestdocum.backend.repository.TenantDepartmentRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentService {
    private final DocumentRepository repository;
    private final DocumentTypeRepository documentTypeRepository;
    private final DocumentCategoryRepository categoryRepository;
    private final TenantDepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final ExpedientRepository expedientRepository;
    private final AuthenticatedUserContext userContext;

    public DocumentService(DocumentRepository repository,
                           DocumentTypeRepository documentTypeRepository,
                           DocumentCategoryRepository categoryRepository,
                           TenantDepartmentRepository departmentRepository,
                           UserRepository userRepository,
                           PatientRepository patientRepository,
                           ExpedientRepository expedientRepository,
                           AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.documentTypeRepository = documentTypeRepository;
        this.categoryRepository = categoryRepository;
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.expedientRepository = expedientRepository;
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
        if (status != null) {
            return repository.searchMineAndStatus(tenantId, userId, value, status, pageable).map(this::toResponse);
        }
        return repository.searchMine(tenantId, userId, value, pageable).map(this::toResponse);
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
        document.setPatientId(request.patientId());
        document.setSpecialty(blankToNull(request.specialty()));
        document.setInstitutionalProcess(blankToNull(request.institutionalProcess()));
        if (request.metadata() != null) {
            document.setMetadata(request.metadata());
        }
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

    @Transactional(readOnly = true)
    public List<DocumentCategory> categories() {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return categoryRepository.findByTenantIdAndActiveIsTrueOrderByNameAsc(tenantId);
    }

    @Transactional(readOnly = true)
    public List<String> specialties() {
        return List.of(
                "Medicina General",
                "Cardiología",
                "Cirugía General",
                "Pediatría",
                "Ginecología y Obstetricia",
                "Radiología e Imagenología",
                "Neurología",
                "Oncología",
                "Traumatología y Ortopedia",
                "Medicina Interna",
                "Anestesiología",
                "Urgencias y Emergencias",
                "Administración y Gestión",
                "Asesoría Legal",
                "Gestión de Calidad"
        );
    }

    @Transactional(readOnly = true)
    public List<String> processes() {
        return List.of(
                "Atención Clínica y Asistencial",
                "Admisión y Registro de Pacientes",
                "Gestión Contractual y Legal",
                "Compras y Contrataciones",
                "Auditoría Médica y Calidad",
                "Recursos Humanos y Nómina",
                "Farmacia y Suministros Médicos",
                "Archivo y Gestión Documental",
                "Dirección y Gestión Estratégica"
        );
    }

    private Document getForTenant(UUID id) {
        return repository.findByIdAndTenantIdAndDeletedAtIsNull(id, userContext.requireTenantId())
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
    }

    private DocumentResponse toResponse(Document document) {
        UUID tenantId = document.getTenantId();
        String docTypeName = null;
        String docTypeCode = null;
        String categoryName = null;
        if (document.getDocumentTypeId() != null) {
            Optional<DocumentType> typeOpt = documentTypeRepository.findByIdAndTenantId(document.getDocumentTypeId(), tenantId);
            if (typeOpt.isPresent()) {
                DocumentType type = typeOpt.get();
                docTypeName = type.getName();
                docTypeCode = type.getCode();
                if (type.getCategoryId() != null) {
                    categoryName = categoryRepository.findByIdAndTenantId(type.getCategoryId(), tenantId)
                            .map(DocumentCategory::getName).orElse(null);
                }
            }
        }

        String deptName = null;
        if (document.getDepartmentId() != null) {
            deptName = departmentRepository.findById(document.getDepartmentId())
                    .map(TenantDepartment::getName).orElse(null);
        }

        String authorName = null;
        if (document.getAuthorId() != null) {
            authorName = userRepository.findById(document.getAuthorId())
                    .map(this::formatUserName).orElse(null);
        }

        String respName = null;
        if (document.getResponsibleId() != null) {
            respName = userRepository.findById(document.getResponsibleId())
                    .map(this::formatUserName).orElse(null);
        }

        String patName = null;
        if (document.getPatientId() != null) {
            patName = patientRepository.findById(document.getPatientId())
                    .map(p -> (p.getFirstName() + " " + p.getLastName() + (p.getDocumentNumber() != null ? " (" + p.getDocumentNumber() + ")" : "")).trim())
                    .orElse(null);
        }

        String expCode = null;
        if (document.getExpedientId() != null) {
            expCode = expedientRepository.findById(document.getExpedientId())
                    .map(e -> e.getCode()).orElse(null);
        }

        return new DocumentResponse(
                document.getId(),
                document.getDocumentTypeId(),
                document.getExpedientId(),
                document.getAuthorId(),
                document.getResponsibleId(),
                document.getDepartmentId(),
                document.getPatientId(),
                document.getSpecialty(),
                document.getInstitutionalProcess(),
                document.getMetadata(),
                document.getCode(),
                document.getName(),
                document.getDescription(),
                document.getStatus(),
                document.getCurrentVersion(),
                document.getIssueDate(),
                document.getExpiryDate(),
                document.getIsExternalSource(),
                document.getSource(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                docTypeName,
                docTypeCode,
                categoryName,
                deptName,
                authorName,
                respName,
                patName,
                expCode
        );
    }

    private String formatUserName(User user) {
        String name = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                + (user.getLastName() == null ? "" : user.getLastName())).trim();
        return name.isEmpty() ? user.getUsername() : name;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isAllowedTransition(Document.DocumentStatus current, Document.DocumentStatus target) {
        if (current == target) return true;
        return switch (current) {
            case DRAFT -> target == Document.DocumentStatus.PENDING || target == Document.DocumentStatus.TRASHED;
            case PENDING -> target == Document.DocumentStatus.IN_REVIEW || target == Document.DocumentStatus.REJECTED;
            case IN_REVIEW -> target == Document.DocumentStatus.APPROVED || target == Document.DocumentStatus.REJECTED || target == Document.DocumentStatus.CORRECTED;
            case REJECTED -> target == Document.DocumentStatus.CORRECTED || target == Document.DocumentStatus.DRAFT || target == Document.DocumentStatus.TRASHED;
            case CORRECTED -> target == Document.DocumentStatus.IN_REVIEW || target == Document.DocumentStatus.APPROVED || target == Document.DocumentStatus.DRAFT;
            case APPROVED -> target == Document.DocumentStatus.CURRENT || target == Document.DocumentStatus.ARCHIVED;
            case CURRENT -> target == Document.DocumentStatus.ARCHIVED || target == Document.DocumentStatus.VOIDED;
            case ARCHIVED -> target == Document.DocumentStatus.CURRENT;
            case VOIDED, TRASHED -> false;
        };
    }
}
