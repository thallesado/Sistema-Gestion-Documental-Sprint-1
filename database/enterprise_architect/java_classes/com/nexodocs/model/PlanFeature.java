package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: PlanFeature
 * Mapea la tabla relacional: plan_features
 */
public class PlanFeature {

    private UUID planId;
    private String featureKey;
    private Boolean isEnabled;
    private String description;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Plan plan;

    public PlanFeature() {
    }

    public UUID getPlanId() {
        return this.planId;
    }

    public void setPlanId(UUID planId) {
        this.planId = planId;
    }

    public String getFeatureKey() {
        return this.featureKey;
    }

    public void setFeatureKey(String featureKey) {
        this.featureKey = featureKey;
    }

    public Boolean getIsEnabled() {
        return this.isEnabled;
    }

    public void setIsEnabled(Boolean isEnabled) {
        this.isEnabled = isEnabled;
    }

    public String getDescription() {
        return this.description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Plan getPlan() {
        return this.plan;
    }

    public void setPlan(Plan plan) {
        this.plan = plan;
    }

}
