package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Acceso de soporte con consentimiento (066): solicitud de la plataforma, decisión del tenant y sesión. */
public final class SupportAccessDtos {
    private SupportAccessDtos() { }

    public record Approval(String approver, String roleCode, Instant approvedAt) { }

    /**
     * status: PENDING_TENANT, PENDING_INTERNAL, APPROVED, EXPIRED (aprobada y vencida), REJECTED, REVOKED o
     * CANCELED. canStartSession solo para quien la pidió mientras está vigente.
     */
    public record Request(UUID id, UUID tenantId, String tenantName, String requestedBy, String reason, List<String> modules,
                          int durationMinutes, boolean breakGlass, String status, String decidedBy, Instant decidedAt,
                          String decisionNote, Instant startsAt, Instant expiresAt, Instant revokedAt, Instant createdAt,
                          List<Approval> approvals, boolean mine, boolean canStartSession) { }

    public record RequestCreate(@NotNull UUID tenantId, @NotEmpty List<@NotBlank String> modules,
                                @Min(15) @Max(240) int durationMinutes, boolean breakGlass,
                                @NotBlank @Size(max = 1000) String reason) { }

    public record Note(@Size(max = 500) String note) { }

    /** Token de solo lectura que la pestaña de soporte guarda; vence con el acceso aprobado. */
    public record Session(String token, Instant expiresAt, UUID tenantId, String tenantName, List<String> permissions) { }

    public record SupportModule(String code, String label, List<String> permissions) { }
}
