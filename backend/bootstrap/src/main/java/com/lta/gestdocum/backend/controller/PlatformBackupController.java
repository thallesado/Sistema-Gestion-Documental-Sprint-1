package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.PlatformBackupService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/platform/backups/full")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformBackupController {
    private final PlatformBackupService service;
    public PlatformBackupController(PlatformBackupService service) { this.service = service; }
    @PostMapping public ResponseEntity<Map<String, Object>> request() throws IOException {
        return ResponseEntity.accepted().body(service.request());
    }
    @GetMapping("/{id}") public Map<String, Object> status(@PathVariable UUID id) { return service.status(id); }
}
