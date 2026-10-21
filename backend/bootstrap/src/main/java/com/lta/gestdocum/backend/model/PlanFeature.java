package com.lta.gestdocum.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "plan_features")
@IdClass(PlanFeature.PlanFeatureId.class)
@Getter
@Setter
@NoArgsConstructor
public class PlanFeature {

    @Id
    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @Id
    @Column(name = "feature_key", nullable = false)
    private String featureKey;

    @Column(name = "is_enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "description")
    private String description;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlanFeatureId implements Serializable {
        private UUID planId;
        private String featureKey;
    }
}
