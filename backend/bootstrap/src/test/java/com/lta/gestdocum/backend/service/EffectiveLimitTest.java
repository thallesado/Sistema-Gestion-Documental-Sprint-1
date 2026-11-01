package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.service.EffectiveLimits.Grant;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EffectiveLimitTest {
    private final Instant now = Instant.parse("2026-10-27T12:00:00Z");

    private Grant recurring(String resource, long units, long perUnit, Instant expires) {
        return new Grant(resource, EffectiveLimits.RECURRING, units, perUnit, expires, 0);
    }

    @Test
    void planPlusSeveralAddons() {
        // Pro con 25 600 MB + 1 paquete de 10 GB + 2 paquetes más de 10 GB.
        List<Grant> grants = List.of(recurring("maxStorageMB", 1, 10_240, null), recurring("maxStorageMB", 2, 10_240, null),
                recurring("maxUsers", 1, 5, null));
        assertEquals(25_600 + 3 * 10_240, EffectiveLimits.effectiveLimit(25_600, "maxStorageMB", grants, now));
        assertEquals(105, EffectiveLimits.effectiveLimit(100, "maxUsers", grants, now));
        assertEquals(500, EffectiveLimits.effectiveLimit(500, "maxDocuments", grants, now));
    }

    @Test
    void unlimitedStaysUnlimited() {
        assertEquals(-1, EffectiveLimits.effectiveLimit(-1, "maxUsers", List.of(recurring("maxUsers", 3, 5, null)), now));
    }

    @Test
    void expiredAddonsDoNotCount() {
        List<Grant> grants = List.of(recurring("maxUsers", 1, 5, now.minus(1, ChronoUnit.SECONDS)),
                recurring("maxUsers", 1, 5, now.plus(10, ChronoUnit.DAYS)));
        assertEquals(15, EffectiveLimits.effectiveLimit(10, "maxUsers", grants, now));
    }

    @Test
    void consumablePacksDoNotRaiseTheMonthlyQuota() {
        List<Grant> grants = List.of(new Grant("maxOcrPagesPerMonth", EffectiveLimits.CONSUMABLE, 1, 1000, now.plus(30, ChronoUnit.DAYS), 700),
                new Grant("maxOcrPagesPerMonth", EffectiveLimits.CONSUMABLE, 1, 1000, now.minus(1, ChronoUnit.DAYS), 1000));
        assertEquals(1000, EffectiveLimits.effectiveLimit(1000, "maxOcrPagesPerMonth", grants, now));
        assertEquals(700, EffectiveLimits.ocrPackBalance(grants, now), "expired packs are not available");
    }

    @Test
    void overflowCountsOnlyPagesAboveTheMonthlyQuota() {
        assertEquals(0, EffectiveLimits.overflow(100, 50, 1000));
        assertEquals(30, EffectiveLimits.overflow(980, 50, 1000));
        assertEquals(50, EffectiveLimits.overflow(1200, 50, 1000));
        assertEquals(0, EffectiveLimits.overflow(5000, 50, -1));
        assertEquals(50, EffectiveLimits.overflow(0, 50, 0), "plan without OCR quota uses only packs");
    }
}
