package com.lta.gestdocum.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;
import java.time.Instant;

@Entity @Table(name="tenants")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Tenant {
    @Id private UUID id;
    private String name;
    @Column(name = "logo_url", length = 500) private String logoUrl;
    private String code;
    private String slug;
    private String email;
    @Column(name="plan_id") private UUID planId;
    @Enumerated(EnumType.STRING) @Column(name="subscription_status")
    private Status status;
    @Column(name="trial_start_at") private Instant trialStartAt;
    @Column(name="trial_ends_at") private Instant trialEndsAt;
    @Column(name="current_period_end") private Instant currentPeriodEnd;
    @Column(name="billing_cycle_v2") private String billingCycle;
    @Column(name="preferred_payment_method") private String preferredPaymentMethod;
    public enum Status { TRIAL, ACTIVE, PAST_DUE, EXPIRED, SUSPENDED, CANCELED }
}
