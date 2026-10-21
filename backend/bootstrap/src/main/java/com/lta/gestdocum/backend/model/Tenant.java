package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.UUID;
import java.time.Instant;

@Entity
@Table(name = "tenants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Tenant {
    @Id
    private UUID id;

    private String name;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "primary_color", length = 20)
    private String primaryColor = "#087f7b";

    private String code;
    private String slug;
    private String email;

    @Column(name = "plan_id")
    private UUID planId;

    @Column(name = "storage_limit_bytes")
    private Long storageLimitBytes;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "subscription_status", columnDefinition = "subscription_status")
    private Status status;

    @Column(name = "trial_start_at")
    private Instant trialStartAt;

    @Column(name = "trial_ends_at")
    private Instant trialEndsAt;

    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    @Column(name = "billing_cycle_v2")
    private String billingCycle;

    @Column(name = "preferred_payment_method")
    private String preferredPaymentMethod;

    @Column(name = "currency", length = 3)
    private String currency = "USD";

    @Column(name = "timezone", length = 50)
    private String timezone = "America/La_Paz";

    @Column(name = "date_format", length = 20)
    private String dateFormat = "YYYY-MM-DD";

    @Column(name = "default_language", length = 10)
    private String defaultLanguage = "es";

    public enum Status { TRIAL, ACTIVE, PAST_DUE, EXPIRED, SUSPENDED, CANCELED }
}
