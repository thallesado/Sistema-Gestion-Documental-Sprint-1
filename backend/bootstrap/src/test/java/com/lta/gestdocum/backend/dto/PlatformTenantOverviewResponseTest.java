package com.lta.gestdocum.backend.dto;

import org.junit.jupiter.api.Test;

import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** La ficha de organización expone una lista cerrada de campos (anexo A): ningún contenido del tenant. */
class PlatformTenantOverviewResponseTest {
    private static final Map<Class<?>, List<String>> ALLOWED = Map.of(
            PlatformTenantOverviewResponse.class, List.of("summary", "administrators", "subscription", "usage", "addons", "payments", "history"),
            PlatformTenantOverviewResponse.Addon.class, List.of("id", "code", "name", "resourceKey", "kind", "units", "unitQuantity",
                    "source", "expiresAt", "remaining", "pendingUnits"),
            PlatformTenantOverviewResponse.Summary.class, List.of("id", "name", "code", "slug", "email", "phone", "createdAt", "lifecycleState"),
            PlatformTenantOverviewResponse.Contact.class, List.of("fullName", "email", "status", "lastLoginAt"),
            PlatformTenantOverviewResponse.Subscription.class, List.of("status", "planCode", "planName", "billingCycle",
                    "priceMonthly", "priceYearly", "trialEndsAt", "currentPeriodEnd", "stripeManaged", "autoRenew",
                    "scheduledPlanCode", "scheduledBillingCycle", "scheduledChangeAt", "canceledAt", "cancellationReason",
                    "deletionScheduledAt", "purgedAt", "inGracePeriod"),
            PlatformTenantOverviewResponse.Usage.class, List.of("users", "storageBytes", "documents", "ocrPagesMonth"),
            PlatformTenantOverviewResponse.UsageItem.class, List.of("used", "limit"),
            PlatformTenantOverviewResponse.Payment.class, List.of("id", "createdAt", "completedAt", "planName", "method",
                    "status", "billingPeriod", "amountUsd", "reference"),
            PlatformTenantOverviewResponse.HistoryEvent.class, List.of("occurredAt", "source", "action", "actor", "reason"));

    private static final List<String> FORBIDDEN = List.of("patient", "paciente", "title", "filename", "file", "content",
            "description", "metadata", "diagnos", "note", "clinical", "expedient", "password", "hash", "token", "dicom", "details");

    @Test
    void everyRecordHasExactlyTheReviewedFields() {
        ALLOWED.forEach((type, fields) -> assertEquals(fields,
                Arrays.stream(type.getRecordComponents()).map(RecordComponent::getName).toList(),
                type.getSimpleName() + " changed: review it against annex A before updating this test"));
    }

    @Test
    void noNestedTypeIsLeftUnreviewed() {
        Set<Class<?>> seen = new HashSet<>();
        collect(PlatformTenantOverviewResponse.class, seen);
        assertEquals(ALLOWED.keySet(), seen);
    }

    @Test
    void noFieldLooksLikeTenantContent() {
        ALLOWED.values().stream().flatMap(List::stream).forEach(field -> FORBIDDEN.forEach(word ->
                assertFalse(field.toLowerCase(Locale.ROOT).contains(word), field + " looks like tenant content")));
    }

    private static void collect(Class<?> type, Set<Class<?>> seen) {
        if (!type.isRecord() || !seen.add(type)) return;
        for (RecordComponent component : type.getRecordComponents()) {
            collect(component.getType(), seen);
            if (component.getGenericType() instanceof ParameterizedType generic) {
                for (var argument : generic.getActualTypeArguments()) if (argument instanceof Class<?> c) collect(c, seen);
            }
        }
    }
}
