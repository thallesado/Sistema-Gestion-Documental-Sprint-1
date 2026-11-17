package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AddonDtos.Reason;
import com.lta.gestdocum.backend.dto.PlatformTeamDtos.*;
import com.lta.gestdocum.backend.service.PlatformTeamService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Equipo de plataforma: solo el superadministrador. */
@RestController
@RequestMapping("/api/v1/platform/team")
@PreAuthorize("hasAuthority('platform:team:manage')")
public class PlatformTeamController {
    private final PlatformTeamService team;

    public PlatformTeamController(PlatformTeamService team) { this.team = team; }

    @GetMapping
    public Team list() { return team.team(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Team create(@Valid @RequestBody MemberCreate request) { return team.create(request); }

    @PutMapping("/{id}/role")
    public Team role(@PathVariable UUID id, @Valid @RequestBody RoleChange request) { return team.changeRole(id, request); }

    @PostMapping("/{id}/status")
    public Team status(@PathVariable UUID id, @Valid @RequestBody StatusChange request) { return team.changeStatus(id, request); }

    @PostMapping("/{id}/mfa-reset")
    public Team resetMfa(@PathVariable UUID id, @Valid @RequestBody Reason request) { return team.resetMfa(id, request.reason()); }
}
