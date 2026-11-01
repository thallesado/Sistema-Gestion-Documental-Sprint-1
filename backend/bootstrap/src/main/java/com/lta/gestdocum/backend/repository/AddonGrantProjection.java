package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.service.EffectiveLimits;

import java.time.Instant;

/** Fila de PlanRepository.findActiveAddonGrants. */
public interface AddonGrantProjection {
    String getResourceKey();
    String getKind();
    Number getUnits();
    Number getUnitQuantity();
    Number getExpiresEpoch();
    Number getRemaining();

    default EffectiveLimits.Grant toGrant() {
        return new EffectiveLimits.Grant(getResourceKey(), getKind(), getUnits().longValue(), getUnitQuantity().longValue(),
                getExpiresEpoch() == null ? null : Instant.ofEpochSecond(getExpiresEpoch().longValue()),
                getRemaining() == null ? 0 : getRemaining().longValue());
    }
}
