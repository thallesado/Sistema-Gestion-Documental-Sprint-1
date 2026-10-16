package com.lta.gestdocum.backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import lombok.Getter;

import java.util.UUID;
import java.math.BigDecimal;

/**
 * Raíz mínima del catálogo global de planes. Los límites y funcionalidades se
 * consultan mediante {@code PlanRepository}, ya que son datos de configuración
 * del plan y no del tenant.
 */
@Entity
@Table(name = "plans")
@Getter
public class Plan {

    @Id
    private UUID id;

    private String code;
    private String name;
    private String description;
    @Column(name = "price_monthly")
    private BigDecimal priceMonthly;
    @Column(name = "price_yearly")
    private BigDecimal priceYearly;
    @Column(name = "is_active")
    private boolean active;
    @Column(name = "sort_order")
    private int sortOrder;
}
