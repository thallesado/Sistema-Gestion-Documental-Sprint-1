package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Solicitudes de las acciones de la ficha de organización; todas exigen motivo. */
public final class PlatformTenantActionRequests {
    private PlatformTenantActionRequests() { }

    /** status: SUSPENDED o ACTIVE (reactivar, también dentro del período de gracia). */
    public record StatusChange(@NotBlank String status, @NotBlank @Size(max = 1000) String reason) { }

    public record TrialExtension(@Min(1) @Max(90) int days, @NotBlank @Size(max = 1000) String reason) { }

    /** acceptOverLimit confirma el cambio aunque el uso actual supere los límites del plan nuevo. */
    public record PlanChange(@NotBlank String planCode, boolean acceptOverLimit,
                             @NotBlank @Size(max = 1000) String reason) { }
}
