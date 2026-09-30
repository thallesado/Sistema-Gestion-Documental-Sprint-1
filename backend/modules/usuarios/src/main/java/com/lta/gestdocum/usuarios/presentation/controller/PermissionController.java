package com.lta.gestdocum.usuarios.presentation.controller;

import com.lta.gestdocum.usuarios.application.dto.PermissionResponse;
import com.lta.gestdocum.shared.exception.NotFoundException;
import com.lta.gestdocum.usuarios.domain.repository.PermissionRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/permissions")
public class PermissionController {
    private final PermissionRepository repository;

    public PermissionController(PermissionRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('permission:read')")
    public List<PermissionResponse> list() {
        return repository.findByIsActiveTrueOrderByModuleAscActionAsc().stream()
                .map(p -> new PermissionResponse(p.getId(), p.getCode(), p.getModule(),
                        p.getAction(), p.getDescription(), p.getCriticality()))
                .toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('permission:read')")
    public PermissionResponse detail(@PathVariable Long id) {
        var p = repository.findById(id).orElseThrow(() -> new NotFoundException("Permiso no encontrado"));
        return new PermissionResponse(p.getId(), p.getCode(), p.getModule(),
                p.getAction(), p.getDescription(), p.getCriticality());
    }
}
