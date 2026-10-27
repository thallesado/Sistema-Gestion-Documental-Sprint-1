package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

/** Contratos de /api/v1/billing/subscription (administrador del tenant). */
public final class SubscriptionLifecycleDtos {

    private SubscriptionLifecycleDtos() {
    }

    /** Estado completo de la suscripción para la pantalla «Gestionar suscripción». */
    public record SubscriptionDetailsResponse(
            String organizationName,
            String status,
            String planCode,
            String planName,
            BigDecimal priceMonthly,
            BigDecimal priceYearly,
            String billingCycle,
            String paymentMethod,
            Instant currentPeriodEnd,
            Instant trialEndsAt,
            boolean stripeManaged,
            boolean autoRenew,
            String scheduledPlanCode,
            String scheduledBillingCycle,
            Instant scheduledChangeAt,
            Instant canceledAt,
            Instant deletionScheduledAt,
            int retentionDays) {
    }

    public record SubscriptionPlanRequest(
            @NotBlank String planCode,
            @Pattern(regexp = "MONTHLY|ANNUAL") String billingCycle) {
    }

    /** Confirmación fuerte: nombre exacto de la organización y contraseña de quien cancela. */
    public record SubscriptionCancelRequest(
            @NotBlank String organizationName,
            @NotBlank String password,
            @Size(max = 500) String reason) {
    }
}
