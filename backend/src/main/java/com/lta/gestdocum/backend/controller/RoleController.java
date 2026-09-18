package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.RoleResponse;
import com.lta.gestdocum.backend.service.RoleService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {
    private final RoleService service;

    public RoleController(RoleService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user:read')")
    public List<RoleResponse> activeRoles() {
        return service.activeRoles();
    }
}
