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
@Table(name = "plan_limits")
@IdClass(PlanLimit.PlanLimitId.class)
@Getter
@Setter
@NoArgsConstructor
public class PlanLimit {

    @Id
    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @Id
    @Column(name = "resource_key", nullable = false)
    private String resourceKey;

    @Column(name = "resource_value", nullable = false)
    private Long resourceValue;

    @Column(name = "unit")
    private String unit;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlanLimitId implements Serializable {
        private UUID planId;
        private String resourceKey;
    }
}
