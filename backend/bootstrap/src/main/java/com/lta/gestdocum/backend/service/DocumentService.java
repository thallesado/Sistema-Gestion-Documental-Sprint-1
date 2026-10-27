package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.dto.DocumentStatusRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.model.DocumentCategory;
import com.lta.gestdocum.backend.model.DocumentType;
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
    private final ComponentPermissionService componentPermissions;
    private AuditRecorder auditRecorder;

    public DocumentService(DocumentRepository repository,
                           DocumentTypeRepository documentTypeRepository,
                           DocumentCategoryRepository categoryRepository,
                           TenantDepartmentRepository departmentRepository,
                           UserRepository userRepository,
                           PatientRepository patientRepository,
                           ExpedientRepository expedientRepository,
                           AuthenticatedUserContext userContext,
                           ComponentPermissionService componentPermissions) {
        this.repository = repository;
        this.documentTypeRepository = documentTypeRepository;
        this.categoryRepository = categoryRepository;
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.patientRepository = patientRepository;
        this.expedientRepository = expedientRepository;
        this.userContext = userContext;
        this.componentPermissions = componentPermissions;
    }

    private PlanLimitService planLimitService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setAuditRecorder(AuditRecorder auditRecorder) {
        this.auditRecorder = auditRecorder;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setPlanLimitService(PlanLimitService planLimitService) {
        this.planLimitService = planLimitService;
    }

    private UserCustomizationService userCustomizationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setUserCustomizationService(UserCustomizationService userCustomizationService) {
        this.userCustomizationService = userCustomizationService;
    }

    @Transactional(readOnly = true)
    public Page<DocumentResponse> find(String filter, Document.DocumentStatus status, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String value = filter == null ? "" : filter.trim();
        ComponentFormAccess access = documentAccess();
        if (status != null) {
            return repository.searchByTenantAndStatus(tenantId, value, status, pageable).map(document -> toResponse(document, access));
        }
        return repository.searchByTenant(tenantId, value, pageable).map(document -> toResponse(document, access));
    }

    @Transactional(readOnly = true)
    public Page<DocumentResponse> findMine(String filter, Document.DocumentStatus status, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        UUID userId = userContext.requireUserId();
        userContext.establishDatabaseContext();
        String value = filter == null ? "" : filter.trim();
        ComponentFormAccess access = documentAccess();
        if (status != null) {
            return repository.searchMineAndStatus(tenantId, userId, value, status, pageable).map(document -> toResponse(document, access));
        }
        return repository.searchMine(tenantId, userId, value, pageable).map(document -> toResponse(document, access));
    }

    @Transactional(readOnly = true)
    public Page<DocumentResponse> findShared(String filter, Document.DocumentStatus status, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        UUID userId = userContext.requireUserId();
        userContext.establishDatabaseContext();
        String value = filter == null ? "" : filter.trim();
        ComponentFormAccess access = documentAccess();
        if (status != null) {
            return repository.searchSharedAndStatus(tenantId, userId, value, status, pageable).map(document -> toResponse(document, access));
        }
        return repository.searchShared(tenantId, userId, value, pageable).map(document -> toResponse(document, access));
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
        if (planLimitService != null) {
            planLimitService.validateDocumentLimit(tenantId);
        }
        if (userCustomizationService != null) {
            userCustomizationService.validateDocumentType(tenantId, request.documentTypeId());
        }
        ComponentFormAccess access = documentAccess();
        requireEditableComponents(access, request);
        String code = access.editable("codigo")
                ? requiredText(request.code(), "El código del documento es obligatorio")
                : generatedCode();
        String name = access.editable("nombre")
                ? requiredText(request.name(), "El nombre del documento es obligatorio")
                : documentTypeRepository.findByIdAndTenantId(request.documentTypeId(), tenantId)
                    .map(DocumentType::getName)
                    .orElseThrow(() -> new NotFoundException("Tipo documental no encontrado"));
        Document document = new Document(tenantId, request.documentTypeId(),
                userContext.requireUserId(), code, name);
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
            Document saved = repository.save(document);
            if (planLimitService != null) {
                planLimitService.recordDocumentCreation(tenantId);
            }
            if (auditRecorder != null) {
                auditRecorder.record("CREATE", "DOCUMENTS", saved.getId(), null,
                        java.util.Map.of("code", saved.getCode(), "name", saved.getName(), "status", String.valueOf(saved.getStatus())));
            }
            return toResponse(saved, access);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException("El código de documento ya existe o referencia datos inválidos");
        }
    }

    @Transactional
    public DocumentResponse changeStatus(UUID id, DocumentStatusRequest request) {
        userContext.establishDatabaseContext();
        Document document = getForTenant(id);
        if (repository.hasActiveWorkflow(document.getTenantId(), id)) {
            throw new IllegalStateException("El estado de este documento lo controla un workflow activo. Resuelve su tarea o cancela el flujo antes de cambiarlo manualmente.");
        }
        if (!isAllowedTransition(document.getStatus(), request.status())) {
            throw new IllegalArgumentException("Transición documental no permitida: "
                    + document.getStatus() + " -> " + request.status());
        }
        Document.DocumentStatus oldStatus = document.getStatus();
        document.setStatus(request.status());
        document.setUpdatedAt(OffsetDateTime.now());
        Document saved = repository.save(document);
        if (auditRecorder != null) {
            auditRecorder.record("UPDATE_STATUS", "DOCUMENTS", saved.getId(),
                    java.util.Map.of("status", String.valueOf(oldStatus)),
                    java.util.Map.of("status", String.valueOf(saved.getStatus())));
        }
        return toResponse(saved);
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

    private ComponentFormAccess documentAccess() {
        return componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM);
    }

    /** Privilegios B2 en el alta: un componente de solo lectura u oculto no puede llegar informado. */
    private void requireEditableComponents(ComponentFormAccess access, DocumentCreateRequest request) {
        access.requireEditableIfProvided("nombre", request.name());
        access.requireEditableIfProvided("codigo", request.code());
        access.requireEditableIfProvided("departamento", request.departmentId());
        access.requireEditableIfProvided("especialidad", request.specialty());
        access.requireEditableIfProvided("proceso", request.institutionalProcess());
        access.requireEditableIfProvided("paciente", request.patientId());
        access.requireEditableIfProvided("expediente", request.expedientId());
        access.requireEditableIfProvided("emision", request.issueDate());
        access.requireEditableIfProvided("vencimiento", request.expiryDate());
        access.requireEditableIfProvided("responsable", request.responsibleId());
        access.requireEditableIfProvided("descripcion", request.description());
    }

    private static String requiredText(String value, String message) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(message);
        return value.trim();
    }

    /** Código asignado por el servidor cuando el perfil no puede escribirlo. */
    private static String generatedCode() {
        return "DOC-" + java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE)
                + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
    }

    private DocumentResponse toResponse(Document document) {
        return toResponse(document, documentAccess());
    }

    /** Los componentes ocultos para el perfil no se devuelven (privilegios B2). */
    private DocumentResponse toResponse(Document document, ComponentFormAccess access) {
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
                access.reveal("expediente", document.getExpedientId()),
                document.getAuthorId(),
                access.reveal("responsable", document.getResponsibleId()),
                access.reveal("departamento", document.getDepartmentId()),
                access.reveal("paciente", document.getPatientId()),
                access.reveal("especialidad", document.getSpecialty()),
                access.reveal("proceso", document.getInstitutionalProcess()),
                hideMetadata(access, document.getMetadata()),
                access.reveal("codigo", document.getCode()),
                access.reveal("nombre", document.getName()),
                access.reveal("descripcion", document.getDescription()),
                document.getStatus(),
                document.getCurrentVersion(),
                access.reveal("emision", document.getIssueDate()),
                access.reveal("vencimiento", document.getExpiryDate()),
                document.getIsExternalSource(),
                document.getSource(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                docTypeName,
                docTypeCode,
                categoryName,
                access.reveal("departamento", deptName),
                authorName,
                access.reveal("responsable", respName),
                access.reveal("paciente", patName),
                access.reveal("expediente", expCode)
        );
    }

    /** Claves de metadata (p. ej. las que rellena el OCR) que duplican un componente configurable del formulario. */
    private static final java.util.Map<String, String> METADATA_COMPONENTS = java.util.Map.of(
            "patientName", "paciente",
            "patientDocumentNumber", "paciente",
            "doctorName", "responsable",
            "issueDate", "emision");

    /** La metadata no puede devolver por la puerta de atrás un valor cuyo componente está oculto. */
    static java.util.Map<String, Object> hideMetadata(ComponentFormAccess access, java.util.Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) return metadata;
        java.util.Map<String, Object> visible = new java.util.LinkedHashMap<>(metadata);
        METADATA_COMPONENTS.forEach((key, component) -> {
            if (!access.visible(component)) visible.remove(key);
        });
        return visible;
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
