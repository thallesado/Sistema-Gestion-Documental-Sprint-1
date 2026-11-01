package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Contratos del catálogo de planes editable (/platform/plans) y de los grupos por defecto. */
public final class PlatformPlanDtos {
    private PlatformPlanDtos() { }

    // -------------------------------------------------------------- respuestas

    public record PlanView(UUID id, String code, String name, String description, boolean active, int sortOrder,
                           long tenants, Map<String, Long> limits, List<FeatureView> features, List<PriceView> prices) { }

    public record FeatureView(String key, boolean enabled, String description) { }

    /** tenants: organizaciones que pagan esta versión (la vigente incluye las que no tienen versión registrada). */
    public record PriceView(UUID id, String billingCycle, BigDecimal amountUsd, String stripePriceId,
                            Instant effectiveFrom, Instant archivedAt, long tenants, long pendingMigration) { }

    public record MigrationResult(int scheduled, List<MigrationSkip> skipped) { }

    public record MigrationSkip(UUID tenantId, String tenant, String reason) { }

    public record RoleTemplateView(UUID id, String name, String description, List<String> permissionCodes,
                                   boolean active, int sortOrder) { }

    public record PermissionOption(String code, String module, String description, String requiredFeature) { }

    public record RoleTemplateCatalog(List<RoleTemplateView> templates, List<PermissionOption> permissions) { }

    // -------------------------------------------------------------- solicitudes

    public record PlanUpdate(@NotBlank @Size(max = 100) String name, @Size(max = 2000) String description,
                             boolean active, @Min(0) int sortOrder, @NotBlank @Size(max = 1000) String reason) { }

    /** acceptImpact confirma el cambio después del aviso de impacto (409 CONFIRMATION_REQUIRED). */
    public record LimitsUpdate(@NotNull Map<String, Long> limits, boolean acceptImpact,
                               @NotBlank @Size(max = 1000) String reason) { }

    public record FeaturesUpdate(@NotNull Map<String, Boolean> features, boolean acceptImpact,
                                 @NotBlank @Size(max = 1000) String reason) { }

    public record PriceCreate(@NotBlank @Pattern(regexp = "MONTHLY|ANNUAL") String billingCycle,
                              @NotNull @DecimalMin("0.00") @DecimalMax("1000000.00") BigDecimal amountUsd,
                              @NotBlank @Size(max = 1000) String reason) { }

    public record Reason(@NotBlank @Size(max = 1000) String reason) { }

    public record RoleTemplateSave(@NotBlank @Size(min = 3, max = 80) String name, @Size(max = 255) String description,
                                   @NotNull List<String> permissionCodes, boolean active, @Min(0) int sortOrder,
                                   @NotBlank @Size(max = 1000) String reason) { }
}
