package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.service.TenantService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {
    private final TenantService service;
    public TenantController(TenantService service) { this.service = service; }
    @GetMapping @PreAuthorize("hasAuthority('platform:tenant:manage')")
    public List<TenantResponse> list() { return service.list(); }
    @PostMapping @PreAuthorize("hasAuthority('platform:tenant:manage')")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public TenantResponse create(@Valid @RequestBody TenantCreateRequest request) { return service.create(request); }
    @PatchMapping("/{id}/status") @PreAuthorize("hasAuthority('platform:tenant:manage')")
    public TenantResponse status(@PathVariable java.util.UUID id, @RequestParam String value) {
        return service.changeStatus(id, value);
    }
}
