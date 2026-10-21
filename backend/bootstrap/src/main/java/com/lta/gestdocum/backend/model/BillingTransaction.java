package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Immutable business receipt except for its short-lived settlement state. */
@Entity
@Table(name = "billing_transactions")
@Getter @Setter @NoArgsConstructor
public class BillingTransaction {
    @Id private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "plan_id", nullable = false) private UUID planId;
    @Column(name = "amount_usd", nullable = false) private BigDecimal amountUsd;
    // 036_billing_engine creates currency as char(3); without CHAR, ddl-auto=validate stops startup.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(nullable = false, length = 3) private String currency = "USD";
    @Enumerated(EnumType.STRING) @Column(name = "payment_method", nullable = false) private PaymentMethod paymentMethod;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private PaymentStatus status;
    @Column(name = "external_reference", nullable = false) private String externalReference;
    @Enumerated(EnumType.STRING) @Column(name = "billing_period", nullable = false) private BillingCycle billingPeriod;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "metadata_json", columnDefinition = "jsonb") private Map<String, Object> metadata;
    @Column(name = "created_at") private Instant createdAt;
    @Column(name = "completed_at") private Instant completedAt;

    public enum PaymentMethod { STRIPE_CARD, BANK_QR, CRYPTO_USDT }
    public enum PaymentStatus { PENDING, COMPLETED, FAILED }
    public enum BillingCycle { MONTHLY, ANNUAL }
}
