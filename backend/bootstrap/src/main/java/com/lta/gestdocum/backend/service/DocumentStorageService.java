package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentVersionResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.DocumentVersion;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.DocumentVersionRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.DigestInputStream;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentStorageService {
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    /** Formatos que puede aportar el OCR; incluye WEBP, que la carga manual de versiones no admite. */
    private static final Set<String> ADOPTABLE_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png", "image/webp");
    private final Path storageRoot;
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final AuthenticatedUserContext context;
    private final PlanEnforcementService planEnforcementService;
    private UserCustomizationService userCustomizationService;

    /** C1: opcional; registra en la auditoría qué versión se subió, sin el contenido del archivo. */
    private AuditRecorder auditRecorder;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setAuditRecorder(AuditRecorder auditRecorder) {
        this.auditRecorder = auditRecorder;
    }

    /** B2: opcional para conservar el constructor existente; sin él no se restringe la acción. */
    private ComponentPermissionService componentPermissions;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setComponentPermissions(ComponentPermissionService componentPermissions) {
        this.componentPermissions = componentPermissions;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setUserCustomizationService(UserCustomizationService userCustomizationService) {
        this.userCustomizationService = userCustomizationService;
    }

    public DocumentStorageService(@Value("${app.storage.local-path:./data/storage}") String storagePath,
                                  DocumentRepository documentRepository,
                                  DocumentVersionRepository versionRepository,
                                  AuthenticatedUserContext context,
                                  PlanEnforcementService planEnforcementService) {
        this.storageRoot = Path.of(storagePath).toAbsolutePath().normalize();
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.context = context;
        this.planEnforcementService = planEnforcementService;
    }

    @Transactional
    public DocumentVersionResponse upload(UUID documentId, MultipartFile file, String reason, String ifMatch) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        var document = documentRepository.findForStateChange(documentId, tenantId)
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
        DocumentStateToken.requireMatch(ifMatch, document);
        if (document.getStatus() == com.lta.gestdocum.backend.model.Document.DocumentStatus.ARCHIVED) {
            throw new IllegalStateException("Restaura el documento antes de agregar una nueva version al archivo historico");
        }
        // La primera versión forma parte del alta; las siguientes son la acción «Subir nueva versión».
        if (componentPermissions != null && versionRepository.existsByTenantIdAndDocumentId(tenantId, documentId)) {
            componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM).requireEditable("accion_subir_version");
        }
        validate(file, reason);
        planEnforcementService.validateStorageLimit(tenantId, file.getSize());
        if (userCustomizationService != null) userCustomizationService.validateUpload(tenantId, file.getSize());
        UUID versionId = UUID.randomUUID();
        Path relative = Path.of(tenantId.toString(), documentId.toString(), versionId.toString());
        Path target = safePath(relative);
        Path temporary = target.resolveSibling(target.getFileName() + ".uploading");
        try {
            Files.createDirectories(target.getParent());
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (DigestInputStream input = new DigestInputStream(file.getInputStream(), digest)) {
                Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING);
            }
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            DocumentVersion version = new DocumentVersion();
            version.setId(versionId);
            version.setTenantId(tenantId);
            version.setDocumentId(documentId);
            version.setAuthorId(context.requireUserId());
            version.setChangeReason(reason.trim());
            version.setFilePath(relative.toString().replace('\\', '/'));
            version.setFileName(safeFileName(file.getOriginalFilename()));
            version.setMimeType(file.getContentType());
            version.setFileSizeBytes(file.getSize());
            version.setChecksumSha256(HexFormat.of().formatHex(digest.digest()));
            version.setCreatedAt(OffsetDateTime.now());
            versionRepository.saveAndFlush(version);
            DocumentVersion saved = versionRepository.findById(versionId).orElse(version);
            recordVersion(documentId, saved);
            return toResponse(saved);
        } catch (Exception exception) {
            try { Files.deleteIfExists(temporary); Files.deleteIfExists(target); } catch (Exception ignored) { }
            if (exception instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException("No se pudo almacenar el archivo", exception);
        }
    }

    @Transactional(readOnly = true)
    public String stateToken(UUID documentId) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        return documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId)
                .map(DocumentStateToken::from)
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
    }

    private void recordVersion(UUID documentId, DocumentVersion saved) {
        if (auditRecorder == null) return;
        Map<String, Object> after = new java.util.LinkedHashMap<>();
        // version_number lo asigna un trigger: la entidad en memoria aún no lo tiene. Las versiones son
        // inmutables y correlativas, así que su número es el total de versiones del documento.
        after.put("versionNumber", saved.getVersionNumber() != null ? saved.getVersionNumber()
                : versionRepository.countByTenantIdAndDocumentId(saved.getTenantId(), documentId));
        after.put("fileName", saved.getFileName());
        after.put("sha256", saved.getChecksumSha256());
        after.put("reason", saved.getChangeReason());
        auditRecorder.record("UPLOAD_VERSION", "DOCUMENTS", documentId, null, after);
    }

    /**
     * Registra un archivo que ya está en disco (p. ej. el original de una digitalización OCR)
     * como una nueva versión del documento. Copia el archivo; el original no se toca.
     */
    @Transactional
    public DocumentVersionResponse adoptExistingFile(UUID documentId, Path source, String fileName,
                                                     String mimeType, String reason) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId)
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
        if (!ADOPTABLE_TYPES.contains(mimeType)) throw new IllegalArgumentException("Tipo de archivo no permitido");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("Motivo de versión inválido");
        UUID versionId = UUID.randomUUID();
        Path relative = Path.of(tenantId.toString(), documentId.toString(), versionId.toString());
        Path target = safePath(relative);
        Path temporary = target.resolveSibling(target.getFileName() + ".uploading");
        try {
            long sourceSize = Files.size(source);
            planEnforcementService.validateStorageLimit(tenantId, sourceSize);
            if (userCustomizationService != null) userCustomizationService.validateUpload(tenantId, sourceSize);
            Files.createDirectories(target.getParent());
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size;
            try (DigestInputStream input = new DigestInputStream(Files.newInputStream(source), digest)) {
                size = Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING);
            }
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            DocumentVersion version = new DocumentVersion();
            version.setId(versionId);
            version.setTenantId(tenantId);
            version.setDocumentId(documentId);
            version.setAuthorId(context.requireUserId());
            version.setChangeReason(reason.trim());
            version.setFilePath(relative.toString().replace('\\', '/'));
            version.setFileName(safeFileName(fileName));
            version.setMimeType(mimeType);
            version.setFileSizeBytes(size);
            version.setChecksumSha256(HexFormat.of().formatHex(digest.digest()));
            version.setCreatedAt(OffsetDateTime.now());
            versionRepository.saveAndFlush(version);
            DocumentVersion saved = versionRepository.findById(versionId).orElse(version);
            recordVersion(documentId, saved);
            return toResponse(saved);
        } catch (Exception exception) {
            try { Files.deleteIfExists(temporary); Files.deleteIfExists(target); } catch (Exception ignored) { }
            if (exception instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException("No se pudo almacenar el archivo", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<DocumentVersionResponse> versions(UUID documentId) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId)
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
        return versionRepository.findByTenantIdAndDocumentIdOrderByVersionNumberDesc(tenantId, documentId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public StoredFile download(UUID documentId, UUID versionId) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        DocumentVersion version = versionRepository.findByIdAndTenantId(versionId, tenantId)
                .filter(item -> item.getDocumentId().equals(documentId))
                .orElseThrow(() -> new NotFoundException("Versión no encontrada"));
        // Versiones registradas sin archivo físico (p. ej. datos semilla): 404, no un NPE con 500.
        if (version.getFilePath() == null || version.getFilePath().isBlank()) throw new NotFoundException("Archivo no disponible");
        try {
            Resource resource = new UrlResource(safePath(Path.of(version.getFilePath())).toUri());
            if (!resource.exists() || !resource.isReadable()) throw new NotFoundException("Archivo no disponible");
            return new StoredFile(resource, version.getFileName(), version.getMimeType());
        } catch (java.net.MalformedURLException exception) {
            throw new NotFoundException("Archivo no disponible");
        }
    }

    private void validate(MultipartFile file, String reason) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("El archivo es obligatorio");
        if (file.getSize() > 25L * 1024 * 1024) throw new IllegalArgumentException("El archivo supera 25 MB");
        if (!ALLOWED_TYPES.contains(file.getContentType())) throw new IllegalArgumentException("Tipo de archivo no permitido");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("Motivo de versión inválido");
    }

    private Path safePath(Path relative) {
        Path resolved = storageRoot.resolve(relative).normalize();
        if (!resolved.startsWith(storageRoot)) throw new IllegalArgumentException("Ruta de almacenamiento inválida");
        return resolved;
    }

    private String safeFileName(String value) {
        String name = value == null ? "archivo" : Path.of(value).getFileName().toString();
        return name.length() <= 255 ? name : name.substring(name.length() - 255);
    }

    private DocumentVersionResponse toResponse(DocumentVersion version) {
        return new DocumentVersionResponse(version.getId(), version.getDocumentId(), version.getVersionNumber(),
                version.getFileName(), version.getMimeType(), version.getFileSizeBytes(), version.getChecksumSha256(),
                version.getChangeReason(), version.getCreatedAt());
    }

    public record StoredFile(Resource resource, String fileName, String mimeType) { }
}
