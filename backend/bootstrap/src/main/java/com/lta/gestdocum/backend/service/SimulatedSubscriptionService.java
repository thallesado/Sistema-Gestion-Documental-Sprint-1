package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.repository.PlanRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

/** Local checkout with the same signup form and persisted payment status via secure functions. */
@Service
public class SimulatedSubscriptionService {
    private final PublicSignupService signup;
    private final PlanRepository planRepository;
    private final JdbcTemplate jdbc;
    private final StripeBillingProperties properties;

    public SimulatedSubscriptionService(
            PublicSignupService signup,
            PlanRepository planRepository,
            JdbcTemplate jdbc,
            StripeBillingProperties properties) {
        this.signup = signup;
        this.planRepository = planRepository;
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @Transactional
    public SubscriptionCheckoutSessionResponse createSignupCheckout(PublicSubscriptionCheckoutRequest request) {
        // Resolver plan y monto
        String planCode = (request.planCode() != null && !request.planCode().isBlank())
                ? request.planCode().trim().toUpperCase(Locale.ROOT) : "BASIC";
        Plan plan = planRepository.findFirstByCodeIgnoreCaseAndActiveTrue(planCode)
                .orElseThrow(() -> new IllegalArgumentException("No hay planes de suscripción disponibles"));

        String billingPeriod = (request.billingPeriod() != null && "ANNUAL".equalsIgnoreCase(request.billingPeriod()))
                ? "ANNUAL" : "MONTHLY";
        BigDecimal amount = "ANNUAL".equals(billingPeriod) ? plan.getPriceYearly() : plan.getPriceMonthly();
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("El plan no tiene un precio válido");
        }

        PublicSignupResponse result = signup.signupForCheckout(new PublicSignupRequest(
                request.tenantName(), null, null,
                request.companyEmail() == null || request.companyEmail().isBlank() ? request.adminEmail() : request.companyEmail(),
                null, planCode, request.administratorName(), request.adminEmail(),
                request.password(), "SIMULATED_CARD", null, billingPeriod));

        String session = "sim_" + UUID.randomUUID().toString().replace("-", "");

        // Llamar a la función SECURITY DEFINER para insertar registros y activar la suscripción
        jdbc.queryForObject(
                "SELECT app.record_simulated_signup_payment(?, ?, ?, ?, ?, ?, ?, ?, ?)",
                UUID.class,
                result.tenantId(),
                plan.getId(),
                billingPeriod,
                request.tenantName().trim(),
                request.companyEmail() == null || request.companyEmail().isBlank() ? request.adminEmail().trim() : request.companyEmail().trim(),
                request.administratorName().trim(),
                request.adminEmail().trim().toLowerCase(Locale.ROOT),
                session,
                amount
        );

        return new SubscriptionCheckoutSessionResponse(session, properties.frontendUrl() + "/planes/exito?session_id=" + session);
    }

    @Transactional(readOnly = true)
    public PublicSubscriptionStatusResponse signupStatus(String session) {
        var rows = jdbc.queryForList("SELECT status, tenant_name, tenant_id FROM app.get_simulated_signup_status(?)", session);
        if (rows.isEmpty()) throw new IllegalArgumentException("Sesión de pago no encontrada");
        var row = rows.getFirst();
        return new PublicSubscriptionStatusResponse(
                row.get("status").toString(),
                row.get("tenant_name").toString(),
                (UUID) row.get("tenant_id"),
                "Pago completado. Tu organización está lista para iniciar sesión."
        );
    }
}
