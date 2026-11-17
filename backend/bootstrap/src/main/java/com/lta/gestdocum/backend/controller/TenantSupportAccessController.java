package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.SupportAccessDtos.Note;
import com.lta.gestdocum.backend.dto.SupportAccessDtos.Request;
import com.lta.gestdocum.backend.service.SupportAccessService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** El administrador del tenant ve las solicitudes de soporte y las aprueba, rechaza o revoca. */
@RestController
@RequestMapping("/api/v1/support-access")
@PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
public class TenantSupportAccessController {
    private final SupportAccessService support;

    public TenantSupportAccessController(SupportAccessService support) { this.support = support; }

    @GetMapping
    public List<Request> list() { return support.tenantList(); }

    @PostMapping("/{id}/approve")
    public List<Request> approve(@PathVariable UUID id, @Valid @RequestBody(required = false) Note note) {
        return support.decide(id, "APPROVE", note == null ? null : note.note());
    }

    @PostMapping("/{id}/reject")
    public List<Request> reject(@PathVariable UUID id, @Valid @RequestBody(required = false) Note note) {
        return support.decide(id, "REJECT", note == null ? null : note.note());
    }

    @PostMapping("/{id}/revoke")
    public List<Request> revoke(@PathVariable UUID id, @Valid @RequestBody(required = false) Note note) {
        return support.decide(id, "REVOKE", note == null ? null : note.note());
    }
}
