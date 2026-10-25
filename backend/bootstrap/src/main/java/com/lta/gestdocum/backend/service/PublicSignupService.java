package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.model.SubscriptionPayment;
import com.lta.gestdocum.backend.model.Tenant;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.SubscriptionPaymentRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;

@Service
public class PublicSignupService {

    private static final Logger log = LoggerFactory.getLogger(PublicSignupService.class);

    private final TenantService tenantService;
    private final TenantRepository tenantRepository;
    private final PlanRepository planRepository;
    private final SubscriptionPaymentRepository subscriptionPaymentRepository;
    private final UserRepository userRepository;
    private final AuthService authService;

    public PublicSignupService(
            TenantService tenantService,
            TenantRepository tenantRepository,
            PlanRepository planRepository,
            SubscriptionPaymentRepository subscriptionPaymentRepository,
            UserRepository userRepository,
            AuthService authService) {
        this.tenantService = tenantService;
        this.tenantRepository = tenantRepository;
        this.planRepository = planRepository;
        this.subscriptionPaymentRepository = subscriptionPaymentRepository;
        this.userRepository = userRepository;
        this.authService = authService;
    }

    /**
     * Registro público y contratación con pago simulado (A3).
     * Reutiliza la creación de tenant de A1, registra la transacción en subscription_payments,
     * activa el tenant e inicia sesión automáticamente.
     */
    @Transactional
    public PublicSignupResponse signup(PublicSignupRequest request) {
        // Resolver plan
        Plan plan = null;
        if (request.planId() != null) {
            plan = planRepository.findById(request.planId()).orElse(null);
        }
        if (plan == null && request.planCode() != null && !request.planCode().isBlank()) {
            plan = planRepository.findFirstByCodeIgnoreCaseAndActiveTrue(request.planCode().trim().toUpperCase(Locale.ROOT)).orElse(null);
        }
        if (plan == null) {
            plan = planRepository.findFirstByCodeIgnoreCaseAndActiveTrue("BASIC")
                    .orElseThrow(() -> new IllegalArgumentException("No hay planes de suscripción disponibles"));
        }

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String slug = (request.companySlug() != null && !request.companySlug().isBlank())
                ? slugify(request.companySlug())
                : slugify(request.companyName()) + "-" + suffix;

        String code = (request.companyCode() != null && !request.companyCode().isBlank())
                ? request.companyCode().trim().toUpperCase(Locale.ROOT)
                : ("ORG-" + suffix).toUpperCase(Locale.ROOT);

        TenantCreateRequest createRequest = new TenantCreateRequest(
                request.companyName().trim(),
                code,
                slug,
                request.companyEmail().trim().toLowerCase(Locale.ROOT),
                plan.getId(),
                request.adminEmail().trim().toLowerCase(Locale.ROOT),
                request.adminName().trim()
        );

        // Si el administrador eligió su contraseña se usa desde el alta (sin contraseña temporal ni correo);
        // si no, TenantService genera una temporal que solo se envía por correo.
        String passwordUsed = request.adminPassword();
        TenantResponse tenantResponse = tenantService.create(createRequest, passwordUsed);
        UUID tenantId = tenantResponse.id();

        // Determinar monto del pago simulado
        String billingPeriod = (request.billingPeriod() != null && "ANNUAL".equalsIgnoreCase(request.billingPeriod()))
                ? "ANNUAL" : "MONTHLY";
        BigDecimal amount = request.amountUsd();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            amount = "ANNUAL".equals(billingPeriod) ? plan.getPriceYearly() : plan.getPriceMonthly();
            if (amount == null) amount = BigDecimal.ZERO;
        }

        String paymentMethod = (request.paymentMethod() != null && !request.paymentMethod().isBlank())
                ? request.paymentMethod().trim()
                : "SIMULATED_CARD";

        String reference = "SIM-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);

        SubscriptionPayment payment = SubscriptionPayment.builder()
                .tenantId(tenantId)
                .planId(plan.getId())
                .companyName(request.companyName().trim())
                .adminEmail(request.adminEmail().trim().toLowerCase(Locale.ROOT))
                .amountUsd(amount)
                .currency("USD")
                .paymentMethod(paymentMethod)
                .billingPeriod(billingPeriod)
                .status("COMPLETED")
                .simulated(true)
                .transactionReference(reference)
                .createdAt(Instant.now())
                .build();
        subscriptionPaymentRepository.save(payment);

        // Activar la suscripción del tenant tras el pago simulado exitoso
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        tenant.setStatus(Tenant.Status.ACTIVE);
        int days = "ANNUAL".equals(billingPeriod) ? 365 : 30;
        tenant.setCurrentPeriodEnd(Instant.now().plus(days, ChronoUnit.DAYS));
        tenant.setBillingCycle(billingPeriod);
        tenant.setPreferredPaymentMethod(paymentMethod);
        tenantRepository.save(tenant);

        // Iniciar sesión automáticamente si se conoce la contraseña
        AuthResponse auth = null;
        if (passwordUsed != null && !passwordUsed.isBlank()) {
            try {
                AuthRequest authRequest = new AuthRequest();
                authRequest.setTenantId(tenantId);
                authRequest.setUsernameOrEmail(request.adminEmail().trim());
                authRequest.setPassword(passwordUsed);
                auth = authService.login(authRequest);
            } catch (Exception ex) {
                log.warn("No se pudo iniciar sesión automáticamente tras signup: {}", ex.getMessage());
            }
        }

        String adminUsername = userRepository.findByTenantAndIdentifier(tenantId, request.adminEmail().trim())
                .map(User::getUsername)
                .orElse(request.adminEmail().trim());

        return new PublicSignupResponse(
                tenantId,
                tenant.getName(),
                adminUsername,
                request.adminEmail().trim(),
                null,
                true,
                reference,
                "Organización creada y suscripción activada exitosamente mediante pago simulado.",
                auth
        );
    }

    private String slugify(String value) {
        String result = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return result.isBlank() ? "empresa" : result.substring(0, Math.min(40, result.length()));
    }
}
