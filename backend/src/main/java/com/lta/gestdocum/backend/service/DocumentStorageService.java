package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentVersionResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.DocumentVersion;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.DocumentVersionRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
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
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentStorageService {
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    private final Path storageRoot;
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final AuthenticatedUserContext context;
    private final EntityManager entityManager;

    public DocumentStorageService(@Value("${app.storage.local-path:./data/storage}") String storagePath,
                                  DocumentRepository documentRepository,
                                  DocumentVersionRepository versionRepository,
                                  AuthenticatedUserContext context,
                                  EntityManager entityManager) {
        this.storageRoot = Path.of(storagePath).toAbsolutePath().normalize();
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.context = context;
        this.entityManager = entityManager;
    }

    @Transactional
    public DocumentVersionResponse upload(UUID documentId, MultipartFile file, String reason) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId)
                .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
        validate(file, reason);
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
            entityManager.refresh(version);
            return toResponse(version);
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
