package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.service.PlatformTechnicalLogService;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/platform/technical-logs")
@PreAuthorize("hasAuthority('platform:tenant:manage')")
public class PlatformTechnicalLogsController {
    private final PlatformTechnicalLogService logs;
    public PlatformTechnicalLogsController(PlatformTechnicalLogService logs) { this.logs = logs; }

    @GetMapping
    public Page<PlatformTechnicalLogService.Event> list(
            @RequestParam(required = false) String level,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        if (level != null && !level.equals("WARN") && !level.equals("ERROR")) throw new IllegalArgumentException("Nivel inválido");
        return logs.list(level, tenantId, page, size);
    }
}
