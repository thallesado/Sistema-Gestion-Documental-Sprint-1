package com.lta.gestdocum.backend.dto;

import java.util.List;
import java.time.Instant;

public record MySubscriptionResponse(
        PlanCatalogResponse plan,
        long activeUsersCount,
        long maxUsers,
        long usedStorageBytes,
        long maxStorageBytes,
        List<String> enabledFeatures,
        String subscriptionStatus,
        Instant trialEndsAt,
        long trialDaysRemaining,
        String billingCycle,
        String preferredPaymentMethod) { }
