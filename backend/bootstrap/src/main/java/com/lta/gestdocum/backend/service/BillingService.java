package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.lta.gestdocum.backend.billing.PaymentGatewayProvider;
import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.model.BillingTransaction;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.model.Tenant;
import com.lta.gestdocum.backend.repository.BillingTransactionRepository;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class BillingService {
    private final AuthenticatedUserContext context;
    private final TenantRepository tenants;
    private final PlanRepository plans;
    private final BillingTransactionRepository transactions;
    private final Map<BillingTransaction.PaymentMethod, PaymentGatewayProvider> gateways;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public BillingService(AuthenticatedUserContext context, TenantRepository tenants, PlanRepository plans,
                          BillingTransactionRepository transactions, List<PaymentGatewayProvider> providers,
                          EntityManager entityManager, ObjectMapper objectMapper) {
        this.context = context; this.tenants = tenants; this.plans = plans; this.transactions = transactions;
        this.gateways = providers.stream().collect(Collectors.toMap(PaymentGatewayProvider::method, Function.identity()));
        this.entityManager = entityManager; this.objectMapper = objectMapper;
    }

    @SuppressWarnings("null")
    @Transactional
    public BillingCheckoutResponse initiate(BillingCheckoutRequest request) {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        Tenant tenant = tenants.findById(tenantId).orElseThrow(() -> new IllegalStateException("Tenant no disponible"));
        String code = request.planCode().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("BASIC", "PRO").contains(code)) throw new IllegalArgumentException("Solo Básico y Pro permiten checkout directo");
        Plan plan = plans.findFirstByCodeIgnoreCaseAndActiveTrue(code).orElseThrow(() -> new IllegalArgumentException("Plan no disponible"));
        BillingTransaction.PaymentMethod method = BillingTransaction.PaymentMethod.valueOf(request.paymentMethod());
        BillingTransaction.BillingCycle cycle = BillingTransaction.BillingCycle.valueOf(request.billingCycle());
        BigDecimal amount = cycle == BillingTransaction.BillingCycle.ANNUAL ? plan.getPriceYearly() : plan.getPriceMonthly();
        if (amount == null || amount.signum() <= 0) throw new IllegalStateException("El plan no tiene un precio de pago configurado");
        PaymentGatewayProvider gateway = Optional.ofNullable(gateways.get(method)).orElseThrow(() -> new IllegalStateException("Método de pago no disponible"));
        UUID id = UUID.randomUUID();
        PaymentGatewayProvider.GatewayPayment payment = gateway.initiate(id, amount, cycle, request.cryptoNetwork());
        BillingTransaction transaction = new BillingTransaction();
        transaction.setId(id); transaction.setTenantId(tenant.getId()); transaction.setPlanId(plan.getId());
        transaction.setAmountUsd(amount); transaction.setCurrency("USD"); transaction.setPaymentMethod(method);
        transaction.setStatus(BillingTransaction.PaymentStatus.PENDING); transaction.setExternalReference(payment.externalReference());
        transaction.setBillingPeriod(cycle); transaction.setMetadata(new LinkedHashMap<>(payment.payload())); transaction.setCreatedAt(Instant.now());
        transactions.save(transaction);
        return new BillingCheckoutResponse(id, method.name(), amount, "USD", payment.externalReference(), payment.expiresAt(), payment.payload());
    }

    @Transactional
    public BillingOverviewResponse confirm(BillingConfirmRequest request) {
        UUID tenantId = context.requireTenantId(); context.establishDatabaseContext();
        BillingTransaction transaction = transactions.findByIdAndTenantId(request.transactionId(), tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Orden de pago no encontrada"));
        if (transaction.getStatus() == BillingTransaction.PaymentStatus.COMPLETED) return overview(tenantId);
        PaymentGatewayProvider gateway = gateways.get(transaction.getPaymentMethod());
        if (gateway.requiresWebhook()) {
            throw new IllegalStateException("El pago con tarjeta se confirma mediante el webhook seguro de Stripe");
        }
        if (isExpired(transaction)) {
            transaction.setStatus(BillingTransaction.PaymentStatus.FAILED); transactions.save(transaction);
            throw new IllegalArgumentException("La orden de pago expiró; inicia una nueva orden");
        }
        if (!gateway.confirm(transaction.getExternalReference(), request.confirmationReference())) {
            transaction.setStatus(BillingTransaction.PaymentStatus.FAILED); transactions.save(transaction);
            throw new IllegalArgumentException("La confirmación del pago no es válida");
        }
        transaction.setStatus(BillingTransaction.PaymentStatus.COMPLETED); transaction.setCompletedAt(Instant.now()); transactions.save(transaction);
        Instant periodEnd = Instant.now().plus(transaction.getBillingPeriod() == BillingTransaction.BillingCycle.ANNUAL ? 365 : 30, ChronoUnit.DAYS);
        if (plans.activateTenantSubscription(tenantId, transaction.getPlanId(), "ACTIVE", periodEnd,
                transaction.getBillingPeriod().name(), transaction.getPaymentMethod().name()) != 1) {
            throw new IllegalStateException("No se pudo activar la suscripción");
        }
        return overview(tenantId);
    }

    /** Called only after StripeWebhookVerifier authenticates the original raw payload. */
    @Transactional
    public void confirmStripeWebhook(String rawPayload) {
        try {
            JsonNode event = objectMapper.readTree(rawPayload);
            String type = event.path("type").asText();
            if (!"payment_intent.succeeded".equals(type) && !"checkout.session.completed".equals(type)) return;
            JsonNode payment = event.path("data").path("object");
            String transactionId = payment.path("metadata").path("transactionId").asText();
            if (transactionId.isBlank()) transactionId = payment.path("client_reference_id").asText();
            String paymentIntent = "checkout.session.completed".equals(type)
                    ? payment.path("payment_intent").asText() : payment.path("id").asText();
            if (transactionId.isBlank() || paymentIntent.isBlank()) {
                throw new IllegalArgumentException("Evento Stripe sin referencia de transacción");
            }
            Object result = entityManager.createNativeQuery(
                    "select app.complete_stripe_payment(cast(:transactionId as uuid), :paymentIntent)")
                    .setParameter("transactionId", UUID.fromString(transactionId))
                    .setParameter("paymentIntent", paymentIntent)
                    .getSingleResult();
            if (!(result instanceof Boolean completed) || !completed) {
                throw new IllegalArgumentException("Evento Stripe no corresponde a una orden pendiente");
            }
        } catch (java.io.IOException exception) {
            throw new IllegalArgumentException("Payload Stripe inválido", exception);
        }
    }

    @Transactional(readOnly = true)
    public BillingOverviewResponse overviewForCurrentTenant() { UUID id = context.requireTenantId(); context.establishDatabaseContext(); return overview(id); }

    private BillingOverviewResponse overview(UUID tenantId) {
        Tenant tenant = tenants.findById(tenantId).orElseThrow(() -> new IllegalStateException("Tenant no disponible"));
        List<BillingInvoiceResponse> invoices = transactions.findByTenantIdOrderByCreatedAtDesc(tenantId).stream().map(this::invoice).toList();
        long days = tenant.getTrialEndsAt() == null ? 0 : Math.max(0, (java.time.Duration.between(Instant.now(), tenant.getTrialEndsAt()).getSeconds() + 86399) / 86400);
        return new BillingOverviewResponse(tenant.getStatus().name(), days, tenant.getTrialEndsAt(), tenant.getCurrentPeriodEnd(), invoices);
    }

    private BillingInvoiceResponse invoice(BillingTransaction tx) { return new BillingInvoiceResponse(tx.getId(), tx.getAmountUsd(), tx.getCurrency(), tx.getPaymentMethod().name(), tx.getStatus().name(), tx.getExternalReference(), tx.getBillingPeriod().name(), tx.getCreatedAt(), tx.getCompletedAt()); }

    private boolean isExpired(BillingTransaction transaction) {
        Object value = transaction.getMetadata() == null ? null : transaction.getMetadata().get("expiresAt");
        if (value == null) return false;
        try { return !Instant.parse(value.toString()).isAfter(Instant.now()); }
        catch (java.time.format.DateTimeParseException ignored) { return true; }
    }

    @Transactional(readOnly = true)
    public RevenueDashboardResponse revenueDashboard() {
        if (context.require().tenantId() != null) throw new AccessDeniedException("El control global de ingresos requiere una cuenta de plataforma");
        Object raw = entityManager.createNativeQuery("select app.revenue_dashboard()").getSingleResult();
        try {
            Map<String, Object> data = objectMapper.readValue(raw.toString(), new TypeReference<>() {});
            return new RevenueDashboardResponse(decimal(data.get("totalRevenueUsd")), decimal(data.get("mrrUsd")), decimal(data.get("arrUsd")),
                    number(data.get("activeSubscriptions")), number(data.get("trialSubscriptions")), decimal(data.get("conversionRate")),
                    decimalMap(data.get("revenueByMethod")), decimalMap(data.get("revenueByPlan")),
                    objectMapper.convertValue(data.get("transactions"), new TypeReference<>() {}));
        } catch (Exception exception) { throw new IllegalStateException("No se pudo leer el tablero de ingresos", exception); }
    }
    private BigDecimal decimal(Object value) { return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString()); }
    private long number(Object value) { return value == null ? 0 : Long.parseLong(value.toString()); }
    private Map<String, BigDecimal> decimalMap(Object value) { Map<String,Object> source = objectMapper.convertValue(value == null ? Map.of() : value, new TypeReference<>() {}); return source.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> decimal(e.getValue()))); }
}
