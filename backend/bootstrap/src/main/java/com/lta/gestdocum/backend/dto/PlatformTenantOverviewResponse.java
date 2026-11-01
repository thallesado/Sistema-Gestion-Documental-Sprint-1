package com.lta.gestdocum.backend.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ficha de organización para el administrador global. Lista cerrada de campos (anexo A del plan):
 * datos de la organización, suscripción, uso en números, pagos y eventos de plataforma. Nunca
 * nombres ni contenido de documentos, pacientes o expedientes; PlatformTenantOverviewResponseTest
 * falla si se agrega un campo sin revisarlo.
 */
public record PlatformTenantOverviewResponse(
        Summary summary,
        List<Contact> administrators,
        Subscription subscription,
        Usage usage,
        List<Addon> addons,
        List<Payment> payments,
        List<HistoryEvent> history
) {
    public record Summary(UUID id, String name, String code, String slug, String email, String phone,
                          Instant createdAt, String lifecycleState) { }

    public record Contact(String fullName, String email, String status, Instant lastLoginAt) { }

    public record Subscription(String status, String planCode, String planName, String billingCycle,
                               BigDecimal priceMonthly, BigDecimal priceYearly, Instant trialEndsAt,
                               Instant currentPeriodEnd, boolean stripeManaged, boolean autoRenew,
                               String scheduledPlanCode, String scheduledBillingCycle, Instant scheduledChangeAt,
                               Instant canceledAt, String cancellationReason, Instant deletionScheduledAt,
                               Instant purgedAt, boolean inGracePeriod) { }

    /** {@code limit} = -1 significa ilimitado. */
    public record UsageItem(long used, long limit) { }

    public record Usage(UsageItem users, UsageItem storageBytes, UsageItem documents, UsageItem ocrPagesMonth) { }

    /** Complementos activos (064); los límites de {@link Usage} ya los incluyen. */
    public record Addon(UUID id, String code, String name, String resourceKey, String kind, int units, long unitQuantity,
                        String source, Instant expiresAt, Long remaining, Integer pendingUnits) { }

    public record Payment(UUID id, Instant createdAt, Instant completedAt, String planName, String method,
                          String status, String billingPeriod, BigDecimal amountUsd, String reference) { }

    /** {@code source}: PLATFORM (acción del admin global) o LIFECYCLE (evento de la suscripción). */
    public record HistoryEvent(Instant occurredAt, String source, String action, String actor, String reason) { }
}
