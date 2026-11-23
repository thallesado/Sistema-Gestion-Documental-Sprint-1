package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Local checkout with the same signup form and persisted payment status. */
@Service
public class SimulatedSubscriptionService {
    private final PublicSignupService signup;
    private final JdbcTemplate jdbc;
    private final StripeBillingProperties properties;

    public SimulatedSubscriptionService(PublicSignupService signup, JdbcTemplate jdbc, StripeBillingProperties properties) {
        this.signup = signup;
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @Transactional
    public SubscriptionCheckoutSessionResponse createSignupCheckout(PublicSubscriptionCheckoutRequest request) {
        PublicSignupResponse result = signup.signupForCheckout(new PublicSignupRequest(
                request.tenantName(), null, null,
                request.companyEmail() == null || request.companyEmail().isBlank() ? request.adminEmail() : request.companyEmail(),
                null, request.planCode(), request.administratorName(), request.adminEmail(),
                request.password(), "SIMULATED_CARD", null, request.billingPeriod()));
        String session = "sim_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.update("""
                insert into tenant_signups(id, plan_id, billing_period, tenant_name, company_email,
                administrator_name, admin_email, password_hash, status, stripe_checkout_id, tenant_id)
                select ?, plan_id, ?, name, email, ?, ?, '', 'COMPLETED', ?, id from tenants where id=?
                """, UUID.randomUUID(), request.billingPeriod() == null ? "MONTHLY" : request.billingPeriod(),
                request.administratorName(), request.adminEmail(), session, result.tenantId());
        jdbc.update("""
                insert into billing_transactions(id, tenant_id, plan_id, amount_usd, currency, payment_method,
                  status, external_reference, billing_period, metadata_json, created_at, completed_at)
                select ?, t.id, t.plan_id, case when ?='ANNUAL' then p.price_yearly else p.price_monthly end,
                  'USD', 'STRIPE_CARD', 'COMPLETED', ?, ?, '{"mode":"simulated","kind":"tenant_signup"}'::jsonb,
                  now(), now() from tenants t join plans p on p.id=t.plan_id where t.id=?
                """, UUID.randomUUID(), request.billingPeriod(), session,
                request.billingPeriod() == null ? "MONTHLY" : request.billingPeriod(), result.tenantId());
        return new SubscriptionCheckoutSessionResponse(session, properties.frontendUrl() + "/planes/exito?session_id=" + session);
    }

    @Transactional(readOnly = true)
    public PublicSubscriptionStatusResponse signupStatus(String session) {
        var rows = jdbc.queryForList("select status, tenant_name, tenant_id from tenant_signups where stripe_checkout_id=?", session);
        if (rows.isEmpty()) throw new IllegalArgumentException("Sesión de pago no encontrada");
        var row = rows.getFirst();
        return new PublicSubscriptionStatusResponse(row.get("status").toString(), row.get("tenant_name").toString(),
                (UUID) row.get("tenant_id"), "Pago simulado completado. Tu organización está lista para iniciar sesión.");
    }
}
