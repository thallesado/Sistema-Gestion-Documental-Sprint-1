package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: PlanLimit
 * Mapea la tabla relacional: plan_limits
 */
public class PlanLimit {

    private UUID planId;
    private String resourceKey;
    private Long resourceValue;
    private String unit;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Plan plan;

    public PlanLimit() {
    }

    public UUID getPlanId() {
        return this.planId;
    }

    public void setPlanId(UUID planId) {
        this.planId = planId;
    }

    public String getResourceKey() {
        return this.resourceKey;
    }

    public void setResourceKey(String resourceKey) {
        this.resourceKey = resourceKey;
    }

    public Long getResourceValue() {
        return this.resourceValue;
    }

    public void setResourceValue(Long resourceValue) {
        this.resourceValue = resourceValue;
    }

    public String getUnit() {
        return this.unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public Plan getPlan() {
        return this.plan;
    }

    public void setPlan(Plan plan) {
        this.plan = plan;
    }

}
