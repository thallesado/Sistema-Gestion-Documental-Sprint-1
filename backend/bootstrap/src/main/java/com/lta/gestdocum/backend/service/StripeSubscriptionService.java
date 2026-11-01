package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.billing.SubscriptionItems;
import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;

/**
 * Suscripciones recurrentes con Stripe Billing. Stripe cobra el primer pago en Checkout, guarda el
 * medio de pago y renueva cada período; esta clase solo crea sesiones y refleja en la base lo que
 * informan los webhooks firmados. No hay cobros, reintentos ni tarjetas en la aplicación.
 */
@Service
public class StripeSubscriptionService {
    private static final Logger log = LoggerFactory.getLogger(StripeSubscriptionService.class);
    static final String KIND_SIGNUP = "tenant_signup";
    static final String KIND_TENANT = "tenant_subscription";
    /** Hay una suscripción viva: no se permite otro Checkout (evita doble cobro). */
    private static final Set<String> LIVE_STATUSES = Set.of("active", "trialing", "past_due", "incomplete");

    private final StripeBillingProperties properties;
    private final StripeApiClient stripe;
    private final JdbcTemplate jdbc;
    private final TenantService tenantService;
    private final PlanRepository plans;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticatedUserContext context;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transaction;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TenantAddonSync addonSync;
    /** Días entre la cancelación y el borrado definitivo de la organización. */
    @org.springframework.beans.factory.annotation.Value("${billing.cancellation.retention-days:30}")
    int retentionDays = 30;

    public StripeSubscriptionService(StripeBillingProperties properties, StripeApiClient stripe, JdbcTemplate jdbc,
                                     TenantService tenantService, PlanRepository plans, PasswordEncoder passwordEncoder,
                                     AuthenticatedUserContext context, EntityManager entityManager,
                                     ObjectMapper objectMapper, PlatformTransactionManager transactionManager) {
        this.properties = properties; this.stripe = stripe; this.jdbc = jdbc; this.tenantService = tenantService;
        this.plans = plans; this.passwordEncoder = passwordEncoder; this.context = context;
        this.entityManager = entityManager; this.objectMapper = objectMapper;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    public boolean configured() { return properties.configured(); }

    // ---------------------------------------------------------------- alta pública

    /** Guarda el formulario como alta pendiente y devuelve la URL de Stripe Checkout. */
    public SubscriptionCheckoutSessionResponse createSignupCheckout(PublicSubscriptionCheckoutRequest request) {
        requireConfigured();
        String planCode = request.planCode().trim().toUpperCase(Locale.ROOT);
        String cycle = request.billingPeriod() == null ? "MONTHLY" : request.billingPeriod();
        Plan plan = plans.findFirstByCodeIgnoreCaseAndActiveTrue(planCode)
                .orElseThrow(() -> new IllegalArgumentException("El plan seleccionado no está disponible"));
        String price = requirePrice(planCode, cycle);
        String adminEmail = request.adminEmail().trim().toLowerCase(Locale.ROOT);
        String companyEmail = request.companyEmail() == null || request.companyEmail().isBlank()
                ? adminEmail : request.companyEmail().trim().toLowerCase(Locale.ROOT);

        UUID signupId = UUID.randomUUID();
        jdbc.update("""
                insert into tenant_signups (id, plan_id, billing_period, tenant_name, company_email,
                  administrator_name, admin_email, password_hash)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, signupId, plan.getId(), cycle, request.tenantName().trim(), companyEmail,
                request.administratorName().trim(), adminEmail, passwordEncoder.encode(request.password()));

        // Solo datos no sensibles: el metadata es visible en el dashboard, logs y API de Stripe.
        Map<String, String> metadata = Map.of("kind", KIND_SIGNUP, "signupId", signupId.toString(),
                "plan", planCode, "billingPeriod", cycle);
        Map<String, String> form = checkoutForm(price, metadata, signupId.toString(),
                properties.frontendUrl() + "/planes/exito?session_id={CHECKOUT_SESSION_ID}",
                properties.frontendUrl() + "/planes?cancelado=1");
        form.put("customer_email", adminEmail);
        try {
            JsonNode session = stripe.createCheckoutSession(form, "tenant-signup-" + signupId);
            jdbc.update("update tenant_signups set stripe_checkout_id = ?, updated_at = now() where id = ?",
                    session.path("id").asText(), signupId);
            return new SubscriptionCheckoutSessionResponse(session.path("id").asText(), requireUrl(session));
        } catch (RuntimeException exception) {
            jdbc.update("update tenant_signups set status = 'EXPIRED', password_hash = '', error = ?, updated_at = now() where id = ?",
                    "No se pudo iniciar Checkout", signupId);
            throw exception;
        }
    }

    /**
     * Estado consultado por la página de retorno. Si el webhook aún no llegó, se pregunta a Stripe:
     * el parámetro session_id solo prueba que el cliente volvió, no que pagó.
     */
    public PublicSubscriptionStatusResponse signupStatus(String sessionId) {
        Map<String, Object> signup = findSignupByCheckout(sessionId);
        if ("PENDING".equals(signup.get("status")) && configured()) {
            try {
                JsonNode session = stripe.retrieveCheckoutSession(sessionId);
                if ("complete".equals(session.path("status").asText())) handleCheckoutPaid(session);
                else if ("expired".equals(session.path("status").asText())) expireSignup(session);
            } catch (RuntimeException exception) {
                // El estado FAILED queda guardado; el webhook de Stripe reintentará el aprovisionamiento.
                log.warn("No se pudo completar el alta desde la consulta de estado {}: {}", sessionId, exception.getMessage());
            }
            signup = findSignupByCheckout(sessionId);
        }
        String status = (String) signup.get("status");
        String message = switch (status) {
            case "COMPLETED" -> "Tu organización está lista. Inicia sesión con el correo y la contraseña que registraste.";
            case "PROVISIONING" -> "Pago confirmado. Estamos creando tu organización.";
            case "FAILED" -> "El pago se recibió pero la organización no pudo crearse todavía; se reintentará automáticamente.";
            case "EXPIRED" -> "La sesión de pago expiró sin completarse. Vuelve a elegir tu plan.";
            default -> "Esperando la confirmación del pago de Stripe.";
        };
        return new PublicSubscriptionStatusResponse(status, (String) signup.get("tenant_name"),
                (UUID) signup.get("tenant_id"), message);
    }

    // ---------------------------------------------------------- organización existente

    /** Checkout para una organización en prueba o vencida; el tenant sale del JWT, nunca del cliente. */
    public SubscriptionCheckoutSessionResponse createTenantCheckout(UUID tenantId, Plan plan, String cycle) {
        requireConfigured();
        String planCode = plan.getCode().toUpperCase(Locale.ROOT);
        String price = requirePrice(planCode, cycle);
        Map<String, Object> tenant = jdbc.queryForMap(
                "select email, stripe_customer_id, stripe_subscription_id, stripe_subscription_status from tenants where id = ?",
                tenantId);
        if (tenant.get("stripe_subscription_id") != null && LIVE_STATUSES.contains(tenant.get("stripe_subscription_status"))) {
            throw new IllegalStateException("La organización ya tiene una suscripción activa; gestiona los cambios desde el portal de facturación");
        }
        Map<String, String> metadata = Map.of("kind", KIND_TENANT, "tenantId", tenantId.toString(),
                "plan", planCode, "billingPeriod", cycle);
        Map<String, String> form = checkoutForm(price, metadata, tenantId.toString(),
                properties.frontendUrl() + "/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
                properties.frontendUrl() + "/billing/checkout?plan=" + planCode + "&cycle=" + cycle + "&checkout=cancelled");
        // Un cliente anterior reutiliza su Customer y sus tarjetas guardadas.
        if (tenant.get("stripe_customer_id") != null) form.put("customer", (String) tenant.get("stripe_customer_id"));
        else form.put("customer_email", (String) tenant.get("email"));
        JsonNode session = stripe.createCheckoutSession(form, null);
        return new SubscriptionCheckoutSessionResponse(session.path("id").asText(), requireUrl(session));
    }

    /**
     * Respaldo del webhook al volver de Checkout: pregunta a Stripe por la sesión y, si está pagada,
     * vincula la suscripción (idempotente). Solo acepta sesiones de la organización autenticada;
     * el session_id de la URL no prueba nada por sí mismo.
     */
    public String confirmTenantCheckout(String sessionId) {
        requireConfigured();
        UUID tenantId = context.requireTenantId();
        JsonNode session = stripe.retrieveCheckoutSession(sessionId);
        JsonNode metadata = session.path("metadata");
        if (!KIND_TENANT.equals(metadata.path("kind").asText()) || !tenantId.toString().equals(metadata.path("tenantId").asText())) {
            throw new org.springframework.security.access.AccessDeniedException("La sesión de pago no pertenece a esta organización");
        }
        String status = session.path("status").asText();
        if ("complete".equals(status)) handleCheckoutPaid(session);
        return status;
    }

    /** Portal alojado por Stripe para cambiar tarjeta o plan, cancelar y descargar facturas. */
    public BillingPortalResponse createPortalSession() {
        requireConfigured();
        UUID tenantId = context.requireTenantId();
        String customer = transaction.execute(status -> {
            context.establishDatabaseContext();
            return jdbc.queryForObject("select stripe_customer_id from tenants where id = ?", String.class, tenantId);
        });
        if (customer == null) throw new IllegalArgumentException("La organización todavía no tiene una cuenta de facturación en Stripe");
        JsonNode session = stripe.createPortalSession(customer, properties.frontendUrl() + "/billing");
        return new BillingPortalResponse(requireUrl(session));
    }

    public boolean isStripeManaged(UUID tenantId) {
        String subscription = jdbc.queryForObject("select stripe_subscription_id from tenants where id = ?", String.class, tenantId);
        return subscription != null;
    }

    // ---------------------------------------------------------------------- webhooks

    /** Procesa los eventos de suscripción; devuelve false si el evento pertenece al flujo de pago único. */
    public boolean handleEvent(JsonNode event) {
        JsonNode object = event.path("data").path("object");
        switch (event.path("type").asText()) {
            case "checkout.session.completed", "checkout.session.async_payment_succeeded" -> {
                if (!isSubscriptionCheckout(object)) return false;
                handleCheckoutPaid(object);
            }
            case "checkout.session.expired" -> {
                if (!isSubscriptionCheckout(object)) return false;
                expireSignup(object);
            }
            case "customer.subscription.updated", "customer.subscription.deleted" -> syncSubscription(object);
            case "invoice.paid" -> recordRenewal(object);
            default -> { return false; }
        }
        return true;
    }

    private boolean isSubscriptionCheckout(JsonNode session) {
        String kind = session.path("metadata").path("kind").asText();
        return KIND_SIGNUP.equals(kind) || KIND_TENANT.equals(kind);
    }

    void handleCheckoutPaid(JsonNode session) {
        String paymentStatus = session.path("payment_status").asText();
        if (!"paid".equals(paymentStatus) && !"no_payment_required".equals(paymentStatus)) {
            // Medio asíncrono: se espera a checkout.session.async_payment_succeeded.
            log.info("Checkout {} completado sin pago confirmado ({})", session.path("id").asText(), paymentStatus);
            return;
        }
        JsonNode metadata = session.path("metadata");
        if (KIND_SIGNUP.equals(metadata.path("kind").asText())) provisionSignup(UUID.fromString(metadata.path("signupId").asText()), session);
        else linkTenantSubscription(UUID.fromString(metadata.path("tenantId").asText()), session);
    }

    private void provisionSignup(UUID signupId, JsonNode session) {
        String customerId = textOrNull(session.path("customer"));
        String subscriptionId = textOrNull(session.path("subscription"));
        // Claim atómico: un webhook repetido o la consulta de estado simultánea no crean dos organizaciones.
        int claimed = jdbc.update("""
                update tenant_signups set status = 'PROVISIONING', error = null, stripe_customer_id = ?,
                  stripe_subscription_id = ?, updated_at = now()
                where id = ? and (status in ('PENDING','FAILED')
                  or (status = 'PROVISIONING' and updated_at < now() - interval '15 minutes'))
                """, customerId, subscriptionId, signupId);
        if (claimed != 1) return;
        try {
            JsonNode subscription = subscriptionId == null ? null : stripe.retrieveSubscription(subscriptionId);
            String invoiceId = textOrNull(session.path("invoice"));
            JsonNode invoice = invoiceId == null ? null : stripe.retrieveInvoice(invoiceId);
            transaction.executeWithoutResult(status -> {
                Map<String, Object> signup = jdbc.queryForMap("select * from tenant_signups where id = ?", signupId);
                String name = (String) signup.get("tenant_name");
                String suffix = UUID.randomUUID().toString().substring(0, 8);
                TenantResponse tenant = tenantService.createWithPasswordHash(new TenantCreateRequest(
                        name,
                        ("ORG-" + suffix).toUpperCase(Locale.ROOT),
                        slugify(name) + "-" + suffix,
                        (String) signup.get("company_email"),
                        (UUID) signup.get("plan_id"),
                        (String) signup.get("admin_email"),
                        (String) signup.get("administrator_name")), (String) signup.get("password_hash"));
                entityManager.flush();
                String cycle = (String) signup.get("billing_period");
                jdbc.update("""
                        update tenants set subscription_status = 'ACTIVE', trial_ends_at = trial_start_at,
                          stripe_customer_id = ?, stripe_subscription_id = ?, stripe_subscription_status = ?,
                          current_period_end = coalesce(?, current_period_end), billing_cycle_v2 = ?,
                          preferred_payment_method = 'STRIPE_CARD'
                        where id = ?
                        """, customerId, subscriptionId, subscription == null ? "active" : subscription.path("status").asText(),
                        timestamp(periodEnd(subscription)), cycle, tenant.id());
                recordInvoice(tenant.id(), (UUID) signup.get("plan_id"), cycle, invoice, subscriptionId);
                jdbc.update("""
                        update tenant_signups set status = 'COMPLETED', tenant_id = ?, password_hash = '', updated_at = now()
                        where id = ?
                        """, tenant.id(), signupId);
            });
            log.info("Alta {} aprovisionada tras el pago de Stripe", signupId);
        } catch (RuntimeException exception) {
            jdbc.update("update tenant_signups set status = 'FAILED', error = ?, updated_at = now() where id = ?",
                    abbreviate(exception.getMessage()), signupId);
            log.error("No se pudo aprovisionar el alta {}", signupId, exception);
            throw exception; // Stripe reintenta el webhook y el claim admite FAILED.
        }
    }

    private void linkTenantSubscription(UUID tenantId, JsonNode session) {
        String customerId = textOrNull(session.path("customer"));
        String subscriptionId = textOrNull(session.path("subscription"));
        if (subscriptionId == null) return;
        // Update condicional: no se pisa otra suscripción viva de la misma organización.
        int linked = jdbc.update("""
                update tenants set stripe_subscription_id = ?, stripe_customer_id = coalesce(?, stripe_customer_id)
                where id = ? and (stripe_subscription_id is null or stripe_subscription_id = ?
                  or stripe_subscription_status is null
                  or stripe_subscription_status not in ('active','trialing','past_due','incomplete'))
                """, subscriptionId, customerId, tenantId, subscriptionId);
        if (linked == 0) {
            log.error("La organización {} ya tenía otra suscripción viva; {} quedó sin vincular", tenantId, subscriptionId);
            return;
        }
        syncTenant(stripe.retrieveSubscription(subscriptionId));
        String invoiceId = textOrNull(session.path("invoice"));
        if (invoiceId != null) {
            Map<String, Object> tenant = jdbc.queryForMap("select plan_id, billing_cycle_v2 from tenants where id = ?", tenantId);
            recordInvoice(tenantId, (UUID) tenant.get("plan_id"), (String) tenant.get("billing_cycle_v2"),
                    stripe.retrieveInvoice(invoiceId), subscriptionId);
        }
    }

    private void expireSignup(JsonNode session) {
        String signupId = session.path("metadata").path("signupId").asText();
        if (signupId.isBlank()) return;
        jdbc.update("update tenant_signups set status = 'EXPIRED', password_hash = '', updated_at = now() where id = ? and status = 'PENDING'",
                UUID.fromString(signupId));
    }

    private void syncSubscription(JsonNode eventSubscription) {
        // Stripe no garantiza el orden: se relee el estado actual para que un evento viejo no pise uno nuevo.
        JsonNode subscription;
        try { subscription = stripe.retrieveSubscription(eventSubscription.path("id").asText()); }
        catch (RuntimeException exception) {
            log.warn("No se pudo releer la suscripción {}: {}", eventSubscription.path("id").asText(), exception.getMessage());
            subscription = eventSubscription;
        }
        syncTenant(subscription);
    }

    private void recordRenewal(JsonNode invoice) {
        String subscriptionId = invoiceSubscription(invoice);
        if (subscriptionId == null) return;
        List<Map<String, Object>> rows = jdbc.queryForList("select id from tenants where stripe_subscription_id = ?", subscriptionId);
        // Sin organización vinculada todavía: el primer cobro lo registra el aprovisionamiento.
        if (rows.isEmpty()) return;
        UUID tenantId = (UUID) rows.get(0).get("id");
        syncSubscription(objectMapper.createObjectNode().put("id", subscriptionId));
        Map<String, Object> tenant = jdbc.queryForMap("select plan_id, billing_cycle_v2 from tenants where id = ?", tenantId);
        recordInvoice(tenantId, (UUID) tenant.get("plan_id"), (String) tenant.get("billing_cycle_v2"), invoice, subscriptionId);
    }

    /** Refleja en tenants el estado de una suscripción de Stripe (webhook o respuesta de la API). */
    void syncTenant(JsonNode subscription) {
        String subscriptionId = subscription.path("id").asText();
        List<Map<String, Object>> rows = jdbc.queryForList("select id from tenants where stripe_subscription_id = ?", subscriptionId);
        if (rows.isEmpty()) return; // suscripción ajena o alta todavía en creación
        String stripeStatus = subscription.path("status").asText();
        // Con complementos (064) la suscripción tiene varios ítems: el plan es el que no es complemento.
        JsonNode price = SubscriptionItems.planItem(subscription).path("price");
        Optional<StripeBillingProperties.PlanPrice> planPrice = properties.planForPrice(price.path("id").asText());
        UUID planId = planPrice.flatMap(p -> plans.findFirstByCodeIgnoreCase(p.planCode())).map(Plan::getId).orElse(null);
        String cycle = planPrice.map(StripeBillingProperties.PlanPrice::cycle)
                .orElse("year".equals(price.path("recurring").path("interval").asText()) ? "ANNUAL" : "MONTHLY");
        String access = accessStatus(stripeStatus);
        String schedule = textOrNull(subscription.path("schedule"));
        // No renovar: según la versión de la API llega como cancel_at_period_end o como cancel_at.
        boolean cancelAtPeriodEnd = subscription.path("cancel_at_period_end").asBoolean(false)
                || subscription.path("cancel_at").asLong(0) > 0;
        // Una suspensión manual de plataforma no se deshace con un webhook de facturación. Al quedar
        // cancelada empieza el período de gracia antes del borrado definitivo de la organización.
        jdbc.update("""
                update tenants set stripe_subscription_status = ?,
                  subscription_status = case when subscription_status = 'SUSPENDED' then subscription_status
                                             else cast(? as subscription_status) end,
                  plan_id = coalesce(?, plan_id), billing_cycle_v2 = ?,
                  current_period_end = coalesce(?, current_period_end),
                  cancel_at_period_end = ?, stripe_schedule_id = cast(? as varchar),
                  scheduled_plan_id = case when cast(? as text) is null or scheduled_plan_id = coalesce(cast(? as uuid), plan_id) then null else scheduled_plan_id end,
                  scheduled_billing_cycle = case when cast(? as text) is null or scheduled_plan_id = coalesce(cast(? as uuid), plan_id) then null else scheduled_billing_cycle end,
                  scheduled_change_at = case when cast(? as text) is null or scheduled_plan_id = coalesce(cast(? as uuid), plan_id) then null else scheduled_change_at end,
                  canceled_at = case when cast(? as text) = 'CANCELED' then coalesce(canceled_at, now()) else canceled_at end,
                  deletion_scheduled_at = case when cast(? as text) = 'CANCELED'
                    then coalesce(deletion_scheduled_at, now() + make_interval(days => ?)) else deletion_scheduled_at end
                where id = ?
                """, stripeStatus, access, planId, cycle, timestamp(periodEnd(subscription)),
                cancelAtPeriodEnd, schedule, schedule, planId, schedule, planId, schedule, planId,
                access, access, retentionDays, rows.get(0).get("id"));
        syncPriceVersion(rows.get(0).get("id"), price.path("id").asText(), schedule);
        if (addonSync != null) addonSync.sync((UUID) rows.get(0).get("id"), subscription, periodEnd(subscription));
    }

    /**
     * Versión de precio que paga la organización (063) y fin de una migración de precio programada:
     * se limpia al cobrarse ya el precio nuevo o si el schedule de Stripe desapareció.
     */
    private void syncPriceVersion(Object tenantId, String priceId, String schedule) {
        try {
            jdbc.update("""
                    update tenants set
                      plan_price_id = coalesce((select pp.id from plan_prices pp where pp.stripe_price_id = ?), plan_price_id),
                      price_change_price_id = case when cast(? as text) is null
                        or price_change_price_id = (select pp.id from plan_prices pp where pp.stripe_price_id = ?)
                        then null else price_change_price_id end,
                      price_change_at = case when cast(? as text) is null
                        or price_change_price_id = (select pp.id from plan_prices pp where pp.stripe_price_id = ?)
                        then null else price_change_at end
                    where id = ?
                    """, priceId, schedule, priceId, schedule, priceId, tenantId);
        } catch (org.springframework.dao.DataAccessException exception) {
            log.warn("No se pudo registrar la versión de precio de {}: {}", tenantId, exception.getMessage());
        }
    }

    private void recordInvoice(UUID tenantId, UUID planId, String cycle, JsonNode invoice, String subscriptionId) {
        if (invoice == null || planId == null) return;
        BigDecimal amount = BigDecimal.valueOf(invoice.path("amount_paid").asLong()).movePointLeft(2);
        if (amount.signum() <= 0) return; // cupón del 100 %: no hay ingreso que registrar
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("stripeInvoiceId", invoice.path("id").asText());
        metadata.put("stripeSubscriptionId", subscriptionId);
        metadata.put("billingReason", invoice.path("billing_reason").asText());
        metadata.put("settledBy", "stripe_webhook");
        try {
            jdbc.update("""
                    insert into billing_transactions (tenant_id, plan_id, amount_usd, currency, payment_method, status,
                      external_reference, billing_period, metadata_json, created_at, completed_at)
                    values (?, ?, ?, ?, 'STRIPE_CARD', 'COMPLETED', ?, ?, cast(? as jsonb), now(), now())
                    on conflict (external_reference) do nothing
                    """, tenantId, planId, amount, invoice.path("currency").asText("usd").toUpperCase(Locale.ROOT),
                    invoice.path("id").asText(), cycle, objectMapper.writeValueAsString(metadata));
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo registrar la factura de Stripe", exception);
        }
    }

    // ---------------------------------------------------------------------- utilidades

    /** Estado de acceso de NexoDocs según el estado Stripe; past_due conserva lectura mientras Stripe reintenta. */
    static String accessStatus(String stripeStatus) {
        return switch (stripeStatus) {
            case "active", "trialing" -> "ACTIVE";
            case "past_due", "incomplete" -> "PAST_DUE";
            case "canceled" -> "CANCELED";
            default -> "EXPIRED"; // unpaid, incomplete_expired, paused
        };
    }

    private Map<String, String> checkoutForm(String price, Map<String, String> metadata, String reference,
                                             String successUrl, String cancelUrl) {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("mode", "subscription");
        form.put("line_items[0][price]", price);
        form.put("line_items[0][quantity]", "1");
        form.put("client_reference_id", reference);
        // También en la suscripción: los eventos customer.subscription.* no traen la sesión.
        metadata.forEach((key, value) -> {
            form.put("metadata[" + key + "]", value);
            form.put("subscription_data[metadata][" + key + "]", value);
        });
        form.put("success_url", successUrl);
        form.put("cancel_url", cancelUrl);
        return form;
    }

    private String requirePrice(String planCode, String cycle) {
        return properties.priceFor(planCode, cycle).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE, "El plan " + planCode + " no tiene precio de Stripe configurado para el ciclo " + cycle));
    }

    private void requireConfigured() {
        if (!configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Los pagos con Stripe no están configurados");
    }

    private Map<String, Object> findSignupByCheckout(String sessionId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select status, tenant_name, tenant_id from tenant_signups where stripe_checkout_id = ?", sessionId);
        if (rows.isEmpty()) throw new NotFoundException("Sesión de pago no encontrada");
        return rows.get(0);
    }

    private static String requireUrl(JsonNode session) {
        String url = session.path("url").asText();
        if (url.isBlank()) throw new IllegalStateException("Stripe no devolvió la URL de pago");
        return url;
    }

    private static String invoiceSubscription(JsonNode invoice) {
        String direct = textOrNull(invoice.path("subscription"));
        // Desde la API 2025-03 la referencia vive en parent.subscription_details.
        return direct != null ? direct : textOrNull(invoice.path("parent").path("subscription_details").path("subscription"));
    }

    private static Instant periodEnd(JsonNode subscription) {
        if (subscription == null) return null;
        // Desde la API 2025-03 el período está en cada item; antes, en la suscripción.
        long end = SubscriptionItems.planItem(subscription).path("current_period_end").asLong(0);
        if (end == 0) end = subscription.path("current_period_end").asLong(0);
        return end == 0 ? null : Instant.ofEpochSecond(end);
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) return null;
        String value = node.isObject() ? node.path("id").asText() : node.asText();
        return value.isBlank() ? null : value;
    }

    private static Timestamp timestamp(Instant instant) { return instant == null ? null : Timestamp.from(instant); }

    private static String abbreviate(String value) {
        if (value == null) return "Error desconocido";
        return value.length() > 500 ? value.substring(0, 500) : value;
    }

    private static String slugify(String value) {
        String result = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return result.isBlank() ? "organizacion" : result.substring(0, Math.min(45, result.length()));
    }
}
