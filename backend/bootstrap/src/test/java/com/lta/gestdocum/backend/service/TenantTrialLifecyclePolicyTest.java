package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TenantTrialLifecyclePolicyTest {
    private static final Instant START = Instant.parse("2026-01-01T00:00:00Z");

    @Test
    void trialLastsTwelveDaysAndGraceStartsAtExactTrialEnd() {
        assertEquals(Instant.parse("2026-01-13T00:00:00Z"),
                TenantTrialLifecyclePolicy.trialEndsAt(START));
        assertEquals(TenantTrialLifecyclePolicy.Phase.TRIAL,
                TenantTrialLifecyclePolicy.phase(START, START.plus(12, ChronoUnit.DAYS).minusNanos(1)));
        assertEquals(TenantTrialLifecyclePolicy.Phase.GRACE_READ_ONLY,
                TenantTrialLifecyclePolicy.phase(START, START.plus(12, ChronoUnit.DAYS)));
    }

    @Test
    void deleteEligibilityStartsAfterThreeFullGraceDays() {
        assertEquals(Instant.parse("2026-01-16T00:00:00Z"),
                TenantTrialLifecyclePolicy.graceEndsAt(START));
        assertEquals(TenantTrialLifecyclePolicy.Phase.GRACE_READ_ONLY,
                TenantTrialLifecyclePolicy.phase(START, START.plus(15, ChronoUnit.DAYS).minusNanos(1)));
        assertEquals(TenantTrialLifecyclePolicy.Phase.DELETE_ELIGIBLE,
                TenantTrialLifecyclePolicy.phase(START, START.plus(15, ChronoUnit.DAYS)));
    }
}
