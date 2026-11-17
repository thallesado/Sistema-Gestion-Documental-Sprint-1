package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Equipo de plataforma (066): cuentas internas de NexoDocs, su rol y su doble factor. */
public final class PlatformTeamDtos {
    private PlatformTeamDtos() { }

    public record Member(UUID id, String fullName, String username, String email, String roleCode, String status,
                         Instant lastLoginAt, boolean mfaEnabled, Instant createdAt) { }

    public record Role(String code, String name, String description, List<String> authorities) { }

    public record Team(List<Member> members, List<Role> roles) { }

    public record MemberCreate(@NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{3,60}") String username,
                               @NotBlank @Email @Size(max = 150) String email,
                               @NotBlank @Size(max = 100) String firstName,
                               @NotBlank @Size(max = 100) String lastName,
                               @NotBlank @Pattern(regexp = "SUPERADMIN|FINANCE|SUPPORT|OPERATIONS") String roleCode,
                               @NotBlank @Size(min = 12, max = 128) String temporaryPassword,
                               @NotBlank @Size(max = 1000) String reason) { }

    public record RoleChange(@NotBlank @Pattern(regexp = "SUPERADMIN|FINANCE|SUPPORT|OPERATIONS") String roleCode,
                             @NotBlank @Size(max = 1000) String reason) { }

    public record StatusChange(@NotBlank @Pattern(regexp = "ACTIVE|INACTIVE") String status,
                               @NotBlank @Size(max = 1000) String reason) { }
}
