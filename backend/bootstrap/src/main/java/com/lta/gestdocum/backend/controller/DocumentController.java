package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.dto.DocumentStatusRequest;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.service.DocumentService;
import com.lta.gestdocum.backend.service.DocumentStorageService;
import com.lta.gestdocum.backend.dto.DocumentVersionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/documents")
@Tag(name = "Documentos", description = "Documentos y estados del tenant autenticado")
@SecurityRequirement(name = "BearerAuth")
public class DocumentController {
    private final DocumentService service;
    private final DocumentStorageService storageService;

    public DocumentController(DocumentService service, DocumentStorageService storageService) {
        this.service = service;
        this.storageService = storageService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('document:read')")
    @Operation(summary = "Listar documentos")
    public ResponseEntity<Page<DocumentResponse>> find(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) Document.DocumentStatus status,
            @ModelAttribute com.lta.gestdocum.backend.dto.DocumentSearchFilters filters,
            Pageable pageable) {
        return ResponseEntity.ok(service.search(filter, status, "all", filters, pageable));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('document:read')")
    @Operation(summary = "Listar mis documentos",
            description = "Documentos del tenant autenticado creados por el usuario o asignados a él")
    public ResponseEntity<Page<DocumentResponse>> findMine(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) Document.DocumentStatus status,
            @ModelAttribute com.lta.gestdocum.backend.dto.DocumentSearchFilters filters,
            Pageable pageable) {
        return ResponseEntity.ok(service.search(filter, status, "mine", filters, pageable));
    }

    @GetMapping("/shared")
    @PreAuthorize("hasAuthority('document:read')")
    @Operation(summary = "Listar documentos compartidos",
            description = "Documentos del tenant autenticado compartidos con el usuario o pertenecientes a otros colaboradores")
    public ResponseEntity<Page<DocumentResponse>> findShared(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) Document.DocumentStatus status,
            @ModelAttribute com.lta.gestdocum.backend.dto.DocumentSearchFilters filters,
            Pageable pageable) {
        return ResponseEntity.ok(service.search(filter, status, "shared", filters, pageable));
    }

    @GetMapping("/categories")
    @PreAuthorize("hasAuthority('document:read')")
    @Operation(summary = "Listar categorías documentales activas")
    public ResponseEntity<java.util.List<com.lta.gestdocum.backend.model.DocumentCategory>> categories() {
        return ResponseEntity.ok(service.categories());
    }

    @GetMapping("/specialties")
    @PreAuthorize("hasAuthority('document:read')")
    @Operation(summary = "Listar especialidades disponibles")
    public ResponseEntity<java.util.List<String>> specialties() {
        return ResponseEntity.ok(service.specialties());
    }

    @GetMapping("/processes")
    @PreAuthorize("hasAuthority('document:read')")
    @Operation(summary = "Listar procesos institucionales disponibles")
    public ResponseEntity<java.util.List<String>> processes() {
        return ResponseEntity.ok(service.processes());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('document:read')")
    public ResponseEntity<DocumentResponse> findById(@PathVariable UUID id) {
        DocumentResponse document = service.findById(id);
        return ResponseEntity.ok().eTag(com.lta.gestdocum.backend.service.DocumentStateToken.from(
                document.id(), document.status(), document.currentVersion(), document.updatedAt())).body(document);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('document:create')")
    public ResponseEntity<DocumentResponse> create(@Valid @RequestBody DocumentCreateRequest request) {
        DocumentResponse document = service.create(request);
        return ResponseEntity.status(201).eTag(com.lta.gestdocum.backend.service.DocumentStateToken.from(
                document.id(), document.status(), document.currentVersion(), document.updatedAt())).body(document);
    }

    public record MetadataUpdate(@jakarta.validation.constraints.NotNull java.util.Map<String, Object> metadata) { }

    @PatchMapping("/{id}/metadata")
    @PreAuthorize("hasAuthority('document:update')")
    public ResponseEntity<DocumentResponse> updateMetadata(@PathVariable UUID id, @Valid @RequestBody MetadataUpdate request) {
        DocumentResponse document = service.updateMetadata(id, request.metadata());
        return ResponseEntity.ok().eTag(com.lta.gestdocum.backend.service.DocumentStateToken.from(
                document.id(), document.status(), document.currentVersion(), document.updatedAt())).body(document);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyAuthority('document:update','document:approve','document:reject','document:archive','document:delete')")
    public ResponseEntity<DocumentResponse> changeStatus(
            @PathVariable UUID id, @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @Valid @RequestBody DocumentStatusRequest request) {
        DocumentResponse document = service.changeStatus(id, request, ifMatch);
        return ResponseEntity.ok().eTag(com.lta.gestdocum.backend.service.DocumentStateToken.from(
                document.id(), document.status(), document.currentVersion(), document.updatedAt())).body(document);
    }

    @PostMapping(path = "/{id}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('document:update')")
    public ResponseEntity<DocumentVersionResponse> upload(
            @PathVariable UUID id, @RequestPart("file") MultipartFile file,
            @RequestPart("changeReason") String changeReason,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
        DocumentVersionResponse version = storageService.upload(id, file, changeReason, ifMatch);
        return ResponseEntity.status(201).eTag(storageService.stateToken(id)).body(version);
    }

    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('document:read')")
    public ResponseEntity<java.util.List<DocumentVersionResponse>> versions(@PathVariable UUID id) {
        return ResponseEntity.ok(storageService.versions(id));
    }

    @GetMapping("/{id}/versions/{versionId}/content")
    @PreAuthorize("hasAuthority('document:read')")
    public ResponseEntity<Resource> download(@PathVariable UUID id, @PathVariable UUID versionId) {
        var stored = storageService.download(id, versionId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(stored.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        org.springframework.http.ContentDisposition.attachment()
                                .filename(stored.fileName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .body(stored.resource());
    }
}
