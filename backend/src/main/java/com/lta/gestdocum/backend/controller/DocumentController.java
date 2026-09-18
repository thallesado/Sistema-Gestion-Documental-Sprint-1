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
            Pageable pageable) {
        return ResponseEntity.ok(service.find(filter, status, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('document:read')")
    public ResponseEntity<DocumentResponse> findById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('document:create')")
    public ResponseEntity<DocumentResponse> create(@Valid @RequestBody DocumentCreateRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyAuthority('document:update','document:approve','document:reject','document:archive','document:delete')")
    public ResponseEntity<DocumentResponse> changeStatus(
            @PathVariable UUID id, @Valid @RequestBody DocumentStatusRequest request) {
        return ResponseEntity.ok(service.changeStatus(id, request));
    }

    @PostMapping(path = "/{id}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('document:update')")
    public ResponseEntity<DocumentVersionResponse> upload(
            @PathVariable UUID id, @RequestPart("file") MultipartFile file,
            @RequestPart("changeReason") String changeReason) {
        return ResponseEntity.status(201).body(storageService.upload(id, file, changeReason));
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
