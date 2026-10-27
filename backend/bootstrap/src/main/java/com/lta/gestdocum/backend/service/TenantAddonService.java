package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.PaymentGatewayProvider;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.billing.SubscriptionItems;
import com.lta.gestdocum.backend.dto.AddonDtos.*;
import com.lta.gestdocum.backend.dto.BillingCheckoutResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.BillingTransaction;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Compra y gestión de complementos por el administrador del tenant (064). Stripe es la fuente de verdad:
 * un recurrente se agrega como ítem de la suscripción (se cobra prorrateado y se renueva con el plan),
 * un consumible se paga con Checkout en modo payment, y sin Stripe se emite una orden QR/USDT por un
 * período. Lee y escribe con el usuario de conexión, como SubscriptionLifecycleService.
 */
@Service
public class TenantAddonService {
    private static final Logger log = LoggerFactory.getLogger(TenantAddonService.class);
    static final String CHECKOUT_KIND = "tenant_addon";
    private static final Set<String> CAN_BUY = Set.of("ACTIVE");

    private final JdbcTemplate jdbc;
    private final AuthenticatedUserContext context;
    private final StripeApiClient stripe;
    private final StripeBillingProperties properties;
    private final TenantAddonSync sync;
    private final Map<BillingTransaction.PaymentMethod, PaymentGatewayProvider> gateways;
    private final ObjectMapper objectMapper;

    public TenantAddonService(JdbcTemplate jdbc, AuthenticatedUserContext context, StripeApiClient stripe,
                              StripeBillingProperties properties, TenantAddonSync sync,
                              List<PaymentGatewayProvider> providers, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.context = context;
        this.stripe = stripe;
        this.properties = properties;
        this.sync = sync;
        this.gateways = providers.stream().collect(Collectors.toMap(PaymentGatewayProvider::method, Function.identity()));
        this.objectMapper = objectMapper;
    }

    // ------------------------------------------------------------------ consulta

    public Overview overview() {
        UUID tenantId = context.requireTenantId();
        return overview(tenantId);
    }

    Overview overview(UUID tenantId) {
        Map<String, Object> tenant = tenant(tenantId);
        String planCode = (String) tenant.get("plan_code");
        String cycle = Objects.toString(tenant.get("billing_cycle_v2"), "MONTHLY");
        boolean stripeSubscription = tenant.get("stripe_subscription_id") != null;
        String blocked = CAN_BUY.contains(tenant.get("status")) ? null
                : "TRIAL".equals(tenant.get("status")) ? "Los complementos se compran con el plan activo: activa tu suscripción primero"
                : "La suscripción no está vigente";

        List<Offer> offers = jdbc.queryForList("""
                select a.code, a.name, a.description, a.resource_key, a.unit_quantity, a.kind, a.validity_months,
                  p.billing_cycle, p.amount_usd, p.stripe_price_id
                from addons a join addon_prices p on p.addon_id = a.id and p.archived_at is null
                  and p.billing_cycle = case when a.kind = 'CONSUMABLE' then 'ONE_TIME' else ? end
                where a.is_active and ? = any(a.plan_codes)
                order by a.sort_order, a.code
                """, cycle, planCode).stream()
                .map(r -> new Offer((String) r.get("code"), (String) r.get("name"), (String) r.get("description"),
                        (String) r.get("resource_key"), number(r.get("unit_quantity")), (String) r.get("kind"),
                        (Integer) r.get("validity_months"), (String) r.get("billing_cycle"), (BigDecimal) r.get("amount_usd"),
                        r.get("stripe_price_id") != null && properties.configured()))
                .toList();

        Map<String, Long> planLimits = planLimits((UUID) tenant.get("plan_id"));
        Map<String, Long> usage = usage(tenantId);
        List<Owned> owned = jdbc.queryForList("""
                select ta.id, a.code, a.name, a.resource_key, a.kind, ta.units, a.unit_quantity, ta.status, ta.source,
                  ta.pending_units, ta.pending_at, ta.expires_at, ta.remaining_quantity, ta.stripe_subscription_item_id
                from tenant_addons ta join addons a on a.id = ta.addon_id
                where ta.tenant_id = ? and ta.status = 'ACTIVE' order by a.sort_order, ta.created_at
                """, tenantId).stream()
                .map(r -> {
                    String resource = (String) r.get("resource_key");
                    long planLimit = planLimits.getOrDefault(resource, -1L);
                    boolean covered = "RECURRING".equals(r.get("kind"))
                            && (planLimit == -1 || usage.getOrDefault(resource, 0L) <= planLimit);
                    return new Owned((UUID) r.get("id"), (String) r.get("code"), (String) r.get("name"), resource,
                            (String) r.get("kind"), ((Number) r.get("units")).intValue(), number(r.get("unit_quantity")),
                            (String) r.get("status"), (String) r.get("source"), (Integer) r.get("pending_units"),
                            PlatformTenantService.instant(r.get("pending_at")), PlatformTenantService.instant(r.get("expires_at")),
                            r.get("remaining_quantity") == null ? null : number(r.get("remaining_quantity")),
                            r.get("stripe_subscription_item_id") != null, covered);
                })
                .toList();
        return new Overview(planCode, cycle, blocked == null, blocked, stripeSubscription, offers, owned,
                upgradeSuggestion(tenant, cycle, tenantId));
    }

    // ------------------------------------------------------------------- compra

    public PurchaseResult purchase(Purchase request) {
        UUID tenantId = context.requireTenantId();
        UUID userId = context.requireUserId();
        Map<String, Object> tenant = tenant(tenantId);
        if (!CAN_BUY.contains(tenant.get("status"))) {
            throw new IllegalStateException("TRIAL".equals(tenant.get("status"))
                    ? "Los complementos se compran con el plan activo: activa tu suscripción primero"
                    : "La suscripción no está vigente");
        }
        String cycle = Objects.toString(tenant.get("billing_cycle_v2"), "MONTHLY");
        Map<String, Object> addon = offeredAddon(request.addonCode(), (String) tenant.get("plan_code"));
        boolean consumable = "CONSUMABLE".equals(addon.get("kind"));
        Map<String, Object> price = currentPrice((UUID) addon.get("id"), consumable ? "ONE_TIME" : cycle);
        String subscriptionId = (String) tenant.get("stripe_subscription_id");
        boolean card = "STRIPE_CARD".equals(request.paymentMethod());

        if (!consumable && subscriptionId != null) {
            // Un recurrente va en la misma suscripción: se paga con la tarjeta de la suscripción.
            if (!card) throw new IllegalArgumentException("Tu suscripción se cobra con tarjeta: el complemento se agrega a ella");
            addToSubscription(tenantId, userId, subscriptionId, addon, price, request.units());
            return new PurchaseResult("SUBSCRIPTION_ITEM", null, null, overview(tenantId));
        }
        if (card) {
            if (!consumable) {
                throw new IllegalStateException("Sin suscripción con tarjeta el complemento recurrente se paga por QR o USDT");
            }
            return new PurchaseResult("CHECKOUT", consumableCheckout(tenantId, tenant, addon, price, request.units()), null, null);
        }
        BillingCheckoutResponse order = manualOrder(tenantId, tenant, addon, price, request, consumable ? "MONTHLY" : cycle);
        return new PurchaseResult("MANUAL_ORDER", null, order, null);
    }

    private void addToSubscription(UUID tenantId, UUID userId, String subscriptionId, Map<String, Object> addon,
                                   Map<String, Object> price, int units) {
        String stripePrice = requireStripePrice(price);
        String code = (String) addon.get("code");
        JsonNode subscription = stripe.retrieveSubscription(subscriptionId);
        Optional<JsonNode> existing = SubscriptionItems.addonItems(subscription).stream()
                .filter(item -> code.equals(item.path("price").path("metadata").path(SubscriptionItems.ADDON_METADATA).asText()))
                .findFirst();
        Map<String, String> form = new LinkedHashMap<>();
        // Cobra ahora la parte proporcional; si la tarjeta falla, Stripe rechaza el cambio.
        form.put("proration_behavior", "always_invoice");
        form.put("payment_behavior", "error_if_incomplete");
        if (existing.isPresent()) {
            long quantity = existing.get().path("quantity").asLong(1) + units;
            if (quantity > 100) throw new IllegalArgumentException("Máximo 100 unidades por complemento");
            form.put("quantity", String.valueOf(quantity));
            stripe.updateSubscriptionItem(existing.get().path("id").asText(), form);
        } else {
            form.put("subscription", subscriptionId);
            form.put("price", stripePrice);
            form.put("quantity", String.valueOf(units));
            form.put("metadata[" + SubscriptionItems.ADDON_METADATA + "]", code);
            stripe.createSubscriptionItem(form, "addon-" + tenantId + "-" + code + "-" + UUID.randomUUID());
        }
        // Se relee la suscripción para registrar las unidades vigentes, sin esperar al webhook.
        JsonNode updated = stripe.retrieveSubscription(subscriptionId);
        sync.sync(tenantId, updated, periodEnd(updated));
        audit(tenantId, userId, "ADDON_PURCHASED", Map.of("addon", code, "units", units, "payment", "STRIPE_SUBSCRIPTION"));
    }

    private String consumableCheckout(UUID tenantId, Map<String, Object> tenant, Map<String, Object> addon,
                                      Map<String, Object> price, int units) {
        String stripePrice = requireStripePrice(price);
        Map<String, String> form = new LinkedHashMap<>();
        form.put("mode", "payment");
        form.put("line_items[0][price]", stripePrice);
        form.put("line_items[0][quantity]", String.valueOf(units));
        form.put("client_reference_id", tenantId.toString());
        form.put("metadata[kind]", CHECKOUT_KIND);
        form.put("metadata[tenantId]", tenantId.toString());
        form.put("metadata[addonId]", addon.get("id").toString());
        form.put("metadata[units]", String.valueOf(units));
        form.put("success_url", properties.frontendUrl() + "/billing/subscription?complementos=ok&session_id={CHECKOUT_SESSION_ID}");
        form.put("cancel_url", properties.frontendUrl() + "/billing/subscription?complementos=cancelado");
        if (tenant.get("stripe_customer_id") != null) form.put("customer", (String) tenant.get("stripe_customer_id"));
        else form.put("customer_email", (String) tenant.get("email"));
        JsonNode session = stripe.createCheckoutSession(form, null);
        String url = session.path("url").asText();
        if (url.isBlank()) throw new IllegalStateException("Stripe no devolvió la URL de pago");
        return url;
    }

    private BillingCheckoutResponse manualOrder(UUID tenantId, Map<String, Object> tenant, Map<String, Object> addon,
                                                Map<String, Object> price, Purchase request, String period) {
        BillingTransaction.PaymentMethod method = BillingTransaction.PaymentMethod.valueOf(request.paymentMethod());
        PaymentGatewayProvider gateway = Optional.ofNullable(gateways.get(method))
                .orElseThrow(() -> new IllegalStateException("Método de pago no disponible"));
        BigDecimal amount = ((BigDecimal) price.get("amount_usd")).multiply(BigDecimal.valueOf(request.units()))
                .setScale(2, RoundingMode.HALF_UP);
        UUID id = UUID.randomUUID();
        PaymentGatewayProvider.GatewayPayment payment = gateway.initiate(id, amount,
                BillingTransaction.BillingCycle.valueOf(period), request.cryptoNetwork());
        Map<String, Object> metadata = new LinkedHashMap<>(payment.payload());
        metadata.put("kind", "addon");
        metadata.put("addonId", addon.get("id").toString());
        metadata.put("addonCode", addon.get("code"));
        metadata.put("units", request.units());
        jdbc.update("""
                insert into billing_transactions (id, tenant_id, plan_id, amount_usd, currency, payment_method, status,
                  external_reference, billing_period, metadata_json, created_at)
                values (?, ?, ?, ?, 'USD', ?, 'PENDING', ?, ?, cast(? as jsonb), now())
                """, id, tenantId, tenant.get("plan_id"), amount, method.name(), payment.externalReference(), period, json(metadata));
        return new BillingCheckoutResponse(id, method.name(), amount, "USD", payment.externalReference(), payment.expiresAt(),
                payment.payload());
    }

    // --------------------------------------------------- reducir o quitar unidades

    /** Rige al final del período pagado; antes se comprueba que el uso actual quepa sin esas unidades. */
    public Overview changeUnits(UUID tenantAddonId, UnitsChange request) {
        UUID tenantId = context.requireTenantId();
        UUID userId = context.requireUserId();
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select ta.id, ta.units, ta.stripe_subscription_item_id, ta.addon_id, a.code, a.resource_key, a.unit_quantity, a.kind
                from tenant_addons ta join addons a on a.id = ta.addon_id
                where ta.id = ? and ta.tenant_id = ? and ta.status = 'ACTIVE'
                """, tenantAddonId, tenantId);
        if (rows.isEmpty()) throw new NotFoundException("Complemento no encontrado");
        Map<String, Object> row = rows.get(0);
        String itemId = (String) row.get("stripe_subscription_item_id");
        if (itemId == null) {
            throw new IllegalStateException("Los complementos de pago manual o de cortesía terminan en su fecha de vencimiento");
        }
        int units = ((Number) row.get("units")).intValue();
        if (request.units() >= units) throw new IllegalArgumentException("Para agregar unidades compra el complemento de nuevo");
        String resource = (String) row.get("resource_key");
        assertUsageFits(tenantId, tenantAddonId, resource, (long) request.units() * number(row.get("unit_quantity")));

        Map<String, Object> tenant = tenant(tenantId);
        // Sin prorrateo: el período ya pagado conserva las unidades; la próxima factura cobra las nuevas.
        if (request.units() == 0) stripe.deleteSubscriptionItem(itemId, "none");
        else stripe.updateSubscriptionItem(itemId, Map.of("quantity", String.valueOf(request.units()), "proration_behavior", "none"));
        Instant effectiveAt = SubscriptionLifecycleService.periodEnd(tenant);
        jdbc.update("""
                update tenant_addons set pending_units = ?, pending_at = ?, updated_at = now() where id = ?
                """, request.units(), Timestamp.from(effectiveAt), tenantAddonId);
        audit(tenantId, userId, request.units() == 0 ? "ADDON_REMOVAL_SCHEDULED" : "ADDON_REDUCTION_SCHEDULED",
                Map.of("addon", row.get("code"), "units", request.units(), "effectiveAt", effectiveAt.toString()));
        return overview(tenantId);
    }

    /** Uso del recurso frente a plan + otros complementos + las unidades que quedarían. */
    void assertUsageFits(UUID tenantId, UUID tenantAddonId, String resource, long remainingQuantity) {
        Map<String, Object> tenant = tenant(tenantId);
        long planLimit = planLimits((UUID) tenant.get("plan_id")).getOrDefault(resource, -1L);
        if (planLimit == -1) return;
        Long others = jdbc.queryForObject("""
                select coalesce(sum(ta.units * a.unit_quantity), 0) from tenant_addons ta join addons a on a.id = ta.addon_id
                where ta.tenant_id = ? and ta.id <> ? and ta.status = 'ACTIVE' and a.kind = 'RECURRING' and a.resource_key = ?
                  and (ta.expires_at is null or ta.expires_at > now())
                """, Long.class, tenantId, tenantAddonId, resource);
        long limit = planLimit + (others == null ? 0 : others) + remainingQuantity;
        long used = usage(tenantId).getOrDefault(resource, 0L);
        if (used > limit) {
            String unit = PlanLimitService.MAX_STORAGE_MB.equals(resource) ? " MB" : PlanLimitService.MAX_USERS.equals(resource) ? " usuarios" : " páginas";
            throw new IllegalStateException("No puedes quitar esas unidades: usas " + used + unit + " y el límite quedaría en "
                    + limit + unit + ". Libera espacio o desactiva usuarios primero.");
        }
    }

    // ----------------------------------------------------- consumibles pagados

    /** Webhook firmado (checkout.session.completed): true si el evento era de un complemento. */
    public boolean handleStripeEvent(JsonNode event) {
        String type = event.path("type").asText();
        if (!"checkout.session.completed".equals(type) && !"checkout.session.async_payment_succeeded".equals(type)) return false;
        JsonNode session = event.path("data").path("object");
        if (!CHECKOUT_KIND.equals(session.path("metadata").path("kind").asText())) return false;
        grantPaidCheckout(session);
        return true;
    }

    /** Respaldo del webhook al volver de Checkout; solo sesiones de la organización autenticada. */
    public Overview confirmCheckout(String sessionId) {
        UUID tenantId = context.requireTenantId();
        if (sessionId == null || !sessionId.matches("cs_[A-Za-z0-9_]{8,200}")) throw new IllegalArgumentException("Sesión de pago inválida");
        JsonNode session = stripe.retrieveCheckoutSession(sessionId);
        if (!tenantId.toString().equals(session.path("metadata").path("tenantId").asText())) {
            throw new AccessDeniedException("La sesión de pago no pertenece a tu organización");
        }
        if (CHECKOUT_KIND.equals(session.path("metadata").path("kind").asText())) grantPaidCheckout(session);
        return overview(tenantId);
    }

    void grantPaidCheckout(JsonNode session) {
        String status = session.path("payment_status").asText();
        if (!"paid".equals(status) && !"no_payment_required".equals(status)) return;
        JsonNode metadata = session.path("metadata");
        UUID tenantId = UUID.fromString(metadata.path("tenantId").asText());
        UUID addonId = UUID.fromString(metadata.path("addonId").asText());
        int units = Integer.parseInt(metadata.path("units").asText("1"));
        String sessionId = session.path("id").asText();
        int inserted = jdbc.update("""
                insert into tenant_addons (tenant_id, addon_id, units, source, stripe_checkout_id, remaining_quantity, expires_at)
                select ?, a.id, ?, 'PURCHASE', ?, ?::bigint * a.unit_quantity, now() + make_interval(months => a.validity_months)
                from addons a where a.id = ? and a.kind = 'CONSUMABLE'
                on conflict (stripe_checkout_id) do nothing
                """, tenantId, units, sessionId, units, addonId);
        if (inserted == 0) return; // webhook repetido o retorno ya procesado
        BigDecimal amount = BigDecimal.valueOf(session.path("amount_total").asLong()).movePointLeft(2);
        String reference = textOr(session.path("payment_intent"), sessionId);
        if (amount.signum() > 0) {
            jdbc.update("""
                    insert into billing_transactions (id, tenant_id, plan_id, amount_usd, currency, payment_method, status,
                      external_reference, billing_period, metadata_json, created_at, completed_at)
                    select gen_random_uuid(), t.id, t.plan_id, ?, 'USD', 'STRIPE_CARD', 'COMPLETED', ?, 'MONTHLY',
                      jsonb_build_object('kind', 'addon', 'addonId', ?::text, 'units', ?, 'checkoutSessionId', ?::text), now(), now()
                    from tenants t where t.id = ? and t.plan_id is not null
                    on conflict (external_reference) do nothing
                    """, amount, reference, addonId.toString(), units, sessionId, tenantId);
        }
        audit(tenantId, null, "ADDON_PURCHASED", Map.of("addonId", addonId.toString(), "units", units, "payment", "STRIPE_CHECKOUT"));
        log.info("Paquete {} acreditado a {} ({} unidades)", addonId, tenantId, units);
    }

    // --------------------------------------------------------------- utilidades

    /** Si los complementos recurrentes cuestan más por mes que pasar al plan siguiente, se sugiere el cambio. */
    UpgradeSuggestion upgradeSuggestion(Map<String, Object> tenant, String cycle, UUID tenantId) {
        BigDecimal addons = jdbc.queryForObject("""
                select coalesce(sum(ta.units * p.amount_usd), 0) from tenant_addons ta
                join addons a on a.id = ta.addon_id and a.kind = 'RECURRING'
                join addon_prices p on p.addon_id = a.id and p.archived_at is null and p.billing_cycle = ?
                where ta.tenant_id = ? and ta.status = 'ACTIVE' and ta.source <> 'COURTESY'
                """, BigDecimal.class, cycle, tenantId);
        if (addons == null || addons.signum() <= 0) return null;
        BigDecimal addonsMonthly = monthly(addons, cycle);
        List<Map<String, Object>> next = jdbc.queryForList("""
                select p.code, p.name, p.price_monthly from plans p, plans current
                where current.id = ? and p.is_active and p.sort_order > current.sort_order and p.price_monthly > current.price_monthly
                order by p.sort_order limit 1
                """, tenant.get("plan_id"));
        if (next.isEmpty()) return null;
        BigDecimal difference = ((BigDecimal) next.get(0).get("price_monthly")).subtract((BigDecimal) tenant.get("price_monthly"));
        if (addonsMonthly.compareTo(difference) <= 0) return null;
        return new UpgradeSuggestion((String) next.get(0).get("code"), (String) next.get(0).get("name"), addonsMonthly,
                difference.setScale(2, RoundingMode.HALF_UP));
    }

    private Map<String, Object> tenant(UUID tenantId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select t.id, t.email, t.subscription_status::text as status, t.plan_id, p.code as plan_code, p.price_monthly,
                  t.billing_cycle_v2, t.stripe_subscription_id, t.stripe_customer_id, t.current_period_end,
                  (select max(b.completed_at) from billing_transactions b where b.tenant_id = t.id and b.status = 'COMPLETED') as last_payment_at
                from tenants t left join plans p on p.id = t.plan_id where t.id = ?
                """, tenantId);
        if (rows.isEmpty()) throw new IllegalStateException("Organización no disponible");
        return rows.get(0);
    }

    private Map<String, Object> offeredAddon(String code, String planCode) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, code, name, kind, resource_key, unit_quantity, validity_months from addons
                where code = ? and is_active and ? = any(plan_codes)
                """, code == null ? "" : code.trim().toUpperCase(Locale.ROOT), planCode);
        if (rows.isEmpty()) throw new IllegalArgumentException("Complemento no disponible para tu plan");
        return rows.get(0);
    }

    private Map<String, Object> currentPrice(UUID addonId, String cycle) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select id, amount_usd, stripe_price_id from addon_prices where addon_id = ? and billing_cycle = ? and archived_at is null",
                addonId, cycle);
        if (rows.isEmpty()) throw new IllegalStateException("El complemento no tiene precio para tu ciclo de facturación");
        return rows.get(0);
    }

    private String requireStripePrice(Map<String, Object> price) {
        String id = (String) price.get("stripe_price_id");
        if (id == null || !properties.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "El complemento todavía no tiene precio en Stripe");
        }
        return id;
    }

    Map<String, Long> planLimits(UUID planId) {
        Map<String, Long> limits = new HashMap<>();
        if (planId == null) return limits;
        jdbc.queryForList("select resource_key, resource_value from plan_limits where plan_id = ?", planId)
                .forEach(r -> limits.put((String) r.get("resource_key"), number(r.get("resource_value"))));
        return limits;
    }

    /** Uso por recurso en las unidades del límite: usuarios activos, MB almacenados y páginas OCR del mes. */
    Map<String, Long> usage(UUID tenantId) {
        Map<String, Object> row = jdbc.queryForMap("""
                select (select count(*) from users u where u.tenant_id = ? and u.status = 'ACTIVE' and u.deleted_at is null) as users,
                  (select coalesce(sum(v.file_size_bytes), 0) from document_versions v where v.tenant_id = ?) as bytes,
                  (select coalesce(max(m.ocr_pages), 0) from tenant_usage_monthly m where m.tenant_id = ?
                     and m.year_month = date_trunc('month', now())::date) as ocr
                """, tenantId, tenantId, tenantId);
        long bytes = number(row.get("bytes"));
        return Map.of(PlanLimitService.MAX_USERS, number(row.get("users")),
                PlanLimitService.MAX_STORAGE_MB, (bytes + 1024 * 1024 - 1) / (1024 * 1024),
                PlanLimitService.MAX_OCR_PAGES, number(row.get("ocr")));
    }

    private void audit(UUID tenantId, UUID userId, String action, Map<String, Object> details) {
        try {
            jdbc.update("""
                    insert into audit_events (tenant_id, user_id, action, entity_type, entity_id, result, details)
                    values (?, ?, ?, 'tenant_addons', ?, 'SUCCESS', cast(? as jsonb))
                    """, tenantId, userId, action, tenantId, json(details));
        } catch (RuntimeException exception) {
            log.warn("No se pudo auditar {} de {}: {}", action, tenantId, exception.getMessage());
        }
    }

    private String json(Map<String, Object> value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException("No se pudo serializar la orden", exception); }
    }

    private static Instant periodEnd(JsonNode subscription) {
        long end = SubscriptionItems.planItem(subscription).path("current_period_end").asLong(0);
        if (end == 0) end = subscription.path("current_period_end").asLong(0);
        return end == 0 ? null : Instant.ofEpochSecond(end);
    }

    static BigDecimal monthly(BigDecimal amount, String cycle) {
        return ("ANNUAL".equals(cycle) ? amount.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP) : amount)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private static String textOr(JsonNode node, String fallback) {
        String text = node == null || node.isNull() ? "" : node.asText();
        return text.isBlank() ? fallback : text;
    }

    private static long number(Object value) { return value == null ? 0 : ((Number) value).longValue(); }
}
