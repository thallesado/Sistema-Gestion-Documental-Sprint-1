package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Contratos de los complementos (064): compra por el tenant y catálogo de la plataforma. */
public final class AddonDtos {
    private AddonDtos() { }

    // ------------------------------------------------------------------ tenant

    /** price: precio del ciclo de la organización (recurrente) o del paquete (consumible). */
    public record Offer(String code, String name, String description, String resourceKey, long unitQuantity, String kind,
                        Integer validityMonths, String billingCycle, BigDecimal price, boolean stripeReady) { }

    public record Owned(UUID id, String code, String name, String resourceKey, String kind, int units, long unitQuantity,
                        String status, String source, Integer pendingUnits, Instant pendingAt, Instant expiresAt,
                        Long remaining, boolean stripeManaged, boolean coveredByPlan) { }

    /** Sugerencia de subir de plan cuando los complementos cuestan más que la diferencia de precio. */
    public record UpgradeSuggestion(String planCode, String planName, BigDecimal addonsMonthlyUsd, BigDecimal planDifferenceMonthlyUsd) { }

    public record Overview(String planCode, String billingCycle, boolean canPurchase, String purchaseBlockedReason,
                           boolean stripeSubscription, List<Offer> offers, List<Owned> owned, UpgradeSuggestion upgradeSuggestion) { }

    public record Purchase(@NotBlank String addonCode, @Min(1) @Max(100) int units,
                           @NotBlank @Pattern(regexp = "STRIPE_CARD|BANK_QR|CRYPTO_USDT") String paymentMethod,
                           String cryptoNetwork) { }

    /** mode: SUBSCRIPTION_ITEM (ya activo), CHECKOUT (ir a checkoutUrl) o MANUAL_ORDER (order con QR/USDT). */
    public record PurchaseResult(String mode, String checkoutUrl, BillingCheckoutResponse order, Overview overview) { }

    public record UnitsChange(@Min(0) @Max(100) int units) { }

    // --------------------------------------------------------------- plataforma

    public record PriceView(UUID id, String billingCycle, BigDecimal amountUsd, String stripePriceId, Instant effectiveFrom,
                            Instant archivedAt) { }

    public record CatalogItem(UUID id, String code, String name, String description, String resourceKey, long unitQuantity,
                              String kind, Integer validityMonths, List<String> planCodes, boolean active, int sortOrder,
                              long activeTenants, List<PriceView> prices) { }

    public record AddonCreate(@NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{2,49}") String code,
                              @NotBlank @Size(max = 100) String name, @Size(max = 500) String description,
                              @NotBlank @Pattern(regexp = "maxUsers|maxStorageMB|maxOcrPagesPerMonth") String resourceKey,
                              @Min(1) long unitQuantity, @NotBlank @Pattern(regexp = "RECURRING|CONSUMABLE") String kind,
                              @Min(1) @Max(36) Integer validityMonths, @NotNull List<String> planCodes,
                              @NotNull Map<String, BigDecimal> prices, @NotBlank @Size(max = 1000) String reason) { }

    public record AddonUpdate(@NotBlank @Size(max = 100) String name, @Size(max = 500) String description,
                              @NotNull List<String> planCodes, boolean active, @Min(0) int sortOrder,
                              @NotBlank @Size(max = 1000) String reason) { }

    public record AddonPrice(@NotBlank @Pattern(regexp = "MONTHLY|ANNUAL|ONE_TIME") String billingCycle,
                             @NotNull @DecimalMin("0.01") @DecimalMax("100000.00") BigDecimal amountUsd,
                             @NotBlank @Size(max = 1000) String reason) { }

    public record CourtesyGrant(@NotBlank String addonCode, @Min(1) @Max(100) int units, @NotNull Instant expiresAt,
                                @NotBlank @Size(max = 1000) String reason) { }

    public record Reason(@NotBlank @Size(max = 1000) String reason) { }
}
