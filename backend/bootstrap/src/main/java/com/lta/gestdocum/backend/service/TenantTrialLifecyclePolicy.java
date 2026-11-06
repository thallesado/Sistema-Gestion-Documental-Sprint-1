package com.lta.gestdocum.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** Pure policy for the 12-day trial and the agreed 3-day read-only grace period. */
public final class TenantTrialLifecyclePolicy {
    public static final long TRIAL_DAYS = 12;
    public static final long GRACE_DAYS = 3;

    private TenantTrialLifecyclePolicy() { }

    public enum Phase { TRIAL, GRACE_READ_ONLY, DELETE_ELIGIBLE }

    public static Instant trialEndsAt(Instant startedAt) {
        return startedAt.plus(TRIAL_DAYS, ChronoUnit.DAYS);
    }

    public static Instant graceEndsAt(Instant startedAt) {
        return trialEndsAt(startedAt).plus(GRACE_DAYS, ChronoUnit.DAYS);
    }

    public static Phase phase(Instant startedAt, Instant now) {
        Instant trialEnd = trialEndsAt(startedAt);
        if (now.isBefore(trialEnd)) return Phase.TRIAL;
        if (now.isBefore(trialEnd.plus(GRACE_DAYS, ChronoUnit.DAYS))) return Phase.GRACE_READ_ONLY;
        return Phase.DELETE_ELIGIBLE;
    }
}
