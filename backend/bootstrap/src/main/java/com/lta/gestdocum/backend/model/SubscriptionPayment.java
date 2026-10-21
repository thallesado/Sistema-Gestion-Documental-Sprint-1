package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "subscription_payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubscriptionPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "plan_id")
    private UUID planId;

    @Column(name = "company_name", nullable = false)
    private String companyName;

    @Column(name = "admin_email", nullable = false)
    private String adminEmail;

    @Column(name = "amount_usd", nullable = false)
    private BigDecimal amountUsd;

    @Column(name = "currency", length = 3, nullable = false)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "payment_method", length = 30, nullable = false)
    @Builder.Default
    private String paymentMethod = "SIMULATED_CARD";

    @Column(name = "billing_period", length = 10, nullable = false)
    @Builder.Default
    private String billingPeriod = "MONTHLY";

    @Column(name = "status", length = 20, nullable = false)
    @Builder.Default
    private String status = "COMPLETED";

    @Column(name = "simulated", nullable = false)
    @Builder.Default
    private boolean simulated = true;

    @Column(name = "transaction_reference", length = 100, nullable = false, unique = true)
    private String transactionReference;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
