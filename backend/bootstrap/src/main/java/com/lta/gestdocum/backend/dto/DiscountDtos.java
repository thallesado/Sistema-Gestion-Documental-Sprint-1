package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos de descuentos y promociones (065): catálogo de plataforma, checkout y vista del tenant. */
public final class DiscountDtos {
    private DiscountDtos() { }

    // --------------------------------------------------------------- plataforma

    public record PromotionCodeView(UUID id, String code, Integer maxRedemptions, long redemptions, Instant expiresAt,
                                    boolean firstTimeOnly, boolean active, boolean stripePublished) { }

    /** redemptions: canjes y descuentos aplicados; discountedUsd: lo descontado en facturas cobradas. */
    public record CouponView(UUID id, String code, String name, BigDecimal percentOff, BigDecimal amountOffUsd, String duration,
                             Integer durationInMonths, List<String> planCodes, Instant redeemBy, boolean active,
                             boolean stripePublished, long redemptions, long activeDiscounts, BigDecimal discountedUsd,
                             BigDecimal revenueUsd, List<PromotionCodeView> promotionCodes) { }

    public record DiscountsOverview(BigDecimal maxPercentOff, int loyaltyMonths, List<CouponView> coupons) { }

    public record CouponCreate(@NotBlank @Pattern(regexp = "[A-Z0-9][A-Z0-9_-]{2,39}") String code,
                               @NotBlank @Size(max = 100) String name,
                               @DecimalMin("0.01") @DecimalMax("100.00") BigDecimal percentOff,
                               @DecimalMin("0.01") @DecimalMax("100000.00") BigDecimal amountOffUsd,
                               @NotBlank @Pattern(regexp = "ONCE|REPEATING") String duration,
                               @Min(1) @Max(36) Integer durationInMonths,
                               @NotEmpty List<String> planCodes,
                               @NotNull Instant redeemBy,
                               @NotBlank @Size(max = 1000) String reason) { }

    public record PromotionCodeCreate(@NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9-]{2,39}") String code,
                                      @Min(1) @Max(100000) Integer maxRedemptions,
                                      @NotNull Instant expiresAt,
                                      boolean firstTimeOnly,
                                      @NotBlank @Size(max = 1000) String reason) { }

    public record Redemption(UUID id, UUID tenantId, String tenantName, String couponCode, String promotionCode, String source,
                             String status, Instant startsAt, Instant endsAt, String reason, String approvedBy,
                             BigDecimal discountedUsd) { }

    /** Cliente frecuente: meses desde el primer pago, sin pagos fallidos en el período. */
    public record LoyaltyCandidate(UUID tenantId, String tenantName, String planCode, String planName, String billingCycle,
                                   Instant firstPaymentAt, long monthsActive, long payments, BigDecimal totalPaidUsd) { }

    public record TenantDiscountApply(@NotNull UUID couponId, @NotBlank @Size(max = 1000) String reason) { }

    // ------------------------------------------------------------ checkout

    public record PromotionCodeCheck(@NotBlank @Size(max = 40) String code,
                                     @NotBlank @Pattern(regexp = "(?i)BASIC|PRO|ENTERPRISE") String planCode,
                                     @Pattern(regexp = "MONTHLY|ANNUAL") String billingCycle) { }

    /** Vista previa del código: firstPaymentUsd es el total del primer cobro con el descuento. */
    public record PromotionPreview(String code, String couponName, BigDecimal percentOff, BigDecimal amountOffUsd,
                                   String duration, Integer durationInMonths, BigDecimal priceUsd, BigDecimal firstPaymentUsd) { }

    // ----------------------------------------------------------------- tenant

    /** Descuento vigente para «Gestionar suscripción»; null si no hay. */
    public record ActiveDiscount(String name, BigDecimal percentOff, BigDecimal amountOffUsd, String duration,
                                 Integer durationInMonths, Instant startsAt, Instant endsAt, String source) { }
}
