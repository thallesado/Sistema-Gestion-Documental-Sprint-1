package com.lta.gestdocum.backend.service;

import java.time.Instant;
import java.util.Collection;

/**
 * Límite efectivo de un recurso: el del plan más los complementos recurrentes activos (064). Único punto
 * de cálculo para usuarios, almacenamiento y páginas OCR; -1 (ilimitado) no se amplía. Los paquetes OCR
 * consumibles no suben la cuota mensual: se descuentan cuando se agota (ver {@link #ocrPackBalance}).
 */
public final class EffectiveLimits {
    public static final String RECURRING = "RECURRING";
    public static final String CONSUMABLE = "CONSUMABLE";

    private EffectiveLimits() { }

    /** Complemento vigente de un tenant, tal como lo devuelve PlanRepository.findActiveAddonGrants. */
    public record Grant(String resourceKey, String kind, long units, long unitQuantity, Instant expiresAt, long remaining) {
        boolean liveAt(Instant now) { return expiresAt == null || expiresAt.isAfter(now); }
    }

    public static long effectiveLimit(long planLimit, String resourceKey, Collection<Grant> grants, Instant now) {
        if (planLimit == -1) return -1;
        long extra = 0;
        for (Grant grant : grants == null ? java.util.List.<Grant>of() : grants) {
            if (RECURRING.equals(grant.kind()) && resourceKey.equals(grant.resourceKey()) && grant.liveAt(now)) {
                extra = Math.addExact(extra, Math.multiplyExact(grant.units(), grant.unitQuantity()));
            }
        }
        return Math.addExact(Math.max(0, planLimit), extra);
    }

    /** Páginas OCR que quedan en paquetes consumibles no vencidos. */
    public static long ocrPackBalance(Collection<Grant> grants, Instant now) {
        long balance = 0;
        for (Grant grant : grants == null ? java.util.List.<Grant>of() : grants) {
            if (CONSUMABLE.equals(grant.kind()) && grant.liveAt(now)) balance = Math.addExact(balance, Math.max(0, grant.remaining()));
        }
        return balance;
    }

    /**
     * Páginas de un trabajo que exceden la cuota mensual y deben salir de los paquetes. {@code used} es el
     * consumo del mes antes del trabajo y {@code monthly} la cuota efectiva (-1 ilimitada).
     */
    public static long overflow(long used, long pages, long monthly) {
        if (monthly == -1 || pages <= 0) return 0;
        long before = Math.max(0, used - monthly);
        long after = Math.max(0, used + pages - monthly);
        return after - before;
    }
}
