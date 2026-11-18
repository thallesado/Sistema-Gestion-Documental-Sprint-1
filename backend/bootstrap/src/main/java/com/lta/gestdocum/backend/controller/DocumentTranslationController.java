package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.DocumentTranslationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/translations")
@PreAuthorize("hasAuthority('translation:read')")
public class DocumentTranslationController {
    private final DocumentTranslationService s;

    public DocumentTranslationController(DocumentTranslationService s) {
        this.s = s;
    }

    public record CreateRequest(
        @NotNull UUID documentId,
        @NotNull UUID versionId,
        String sourceLanguage,
        String targetLanguage,
        boolean consent
    ) {}

    public record UpdateSegment(
        @NotBlank @Size(max = 5000) String reviewedText,
        String status
    ) {}

    public record PublishRequest(
        @Size(max = 255) String title
    ) {}

    public record CancelRequest(
        @Size(max = 1000) String reason
    ) {}

    public record GlossaryItem(
        UUID id,
        @NotBlank @Size(max = 200) String sourceTerm,
        @NotBlank @Size(max = 200) String targetTerm,
        String sourceLanguage,
        String targetLanguage,
        Boolean active
    ) {}

    @GetMapping("/options")
    public Map<String, Object> options() {
        return s.options();
    }

    @GetMapping("/requests")
    public Map<String, Object> list(
        @RequestParam(defaultValue = "") String search,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return s.list(search, status, page, size);
    }

    @GetMapping("/requests/{id}")
    public Map<String, Object> detail(@PathVariable UUID id) {
        return s.detail(id);
    }

    @PostMapping("/requests")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateRequest b) {
        return ResponseEntity.status(201).body(s.create(b.documentId(), b.versionId(), b.sourceLanguage(), b.targetLanguage(), b.consent()));
    }

    @PatchMapping("/requests/{id}/segments/{segmentId}")
    public Map<String, Object> updateSegment(
        @PathVariable UUID id,
        @PathVariable UUID segmentId,
        @Valid @RequestBody UpdateSegment b
    ) {
        return s.updateSegment(id, segmentId, b.reviewedText(), b.status());
    }

    @PostMapping("/requests/{id}/publish")
    public Map<String, Object> publish(@PathVariable UUID id, @RequestBody(required = false) PublishRequest b) {
        return s.publish(id, b != null ? b.title() : null);
    }

    @PostMapping("/requests/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable UUID id, @RequestBody(required = false) CancelRequest b) {
        return s.cancel(id, b != null ? b.reason() : null);
    }

    @PostMapping("/glossary")
    public ResponseEntity<Map<String, Object>> saveGlossary(@Valid @RequestBody GlossaryItem b) {
        return ResponseEntity.status(201).body(s.saveGlossary(
            b.id(), b.sourceTerm(), b.targetTerm(), b.sourceLanguage(), b.targetLanguage(),
            b.active() == null || b.active()
        ));
    }

    @DeleteMapping("/glossary/{id}")
    public ResponseEntity<Void> deleteGlossary(@PathVariable UUID id) {
        s.deleteGlossary(id);
        return ResponseEntity.noContent().build();
    }
}
