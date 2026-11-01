package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.billing.SubscriptionItems;
import com.lta.gestdocum.backend.dto.AddonDtos.*;
import com.lta.gestdocum.backend.exception.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Catálogo de complementos y cortesías desde la administración global (064). Los precios se versionan
 * como los de los planes (063): Stripe primero, después la base; las suscripciones con un precio anterior
 * lo conservan. Cada Price lleva metadata addonCode para distinguir el ítem del plan en la suscripción.
 */
@Service
public class PlatformAddonService {
    private static final Logger log = LoggerFactory.getLogger(PlatformAddonService.class);
    private static final Set<String> PLAN_CODES = Set.of("BASIC", "PRO", "ENTERPRISE");

    private final JdbcTemplate jdbc;
    private final PlatformAuditService audit;
    private final StripeApiClient stripe;
    private final StripeBillingProperties properties;
    private final TransactionTemplate transaction;

    public PlatformAddonService(JdbcTemplate jdbc, PlatformAuditService audit, StripeApiClient stripe,
                                StripeBillingProperties properties, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.stripe = stripe;
        this.properties = properties;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    // ------------------------------------------------------------------ catálogo

    @Transactional(readOnly = true)
    public List<CatalogItem> catalog() {
        audit.requirePlatformAccount();
        return jdbc.queryForList("select id from addons order by sort_order, code").stream()
                .map(r -> item((UUID) r.get("id"))).toList();
    }

    CatalogItem item(UUID addonId) {
        Map<String, Object> a = addon(addonId);
        List<PriceView> prices = jdbc.queryForList("""
                select id, billing_cycle, amount_usd, stripe_price_id, effective_from, archived_at from addon_prices
                where addon_id = ? order by billing_cycle, effective_from desc
                """, addonId).stream().map(r -> new PriceView((UUID) r.get("id"), (String) r.get("billing_cycle"),
                (BigDecimal) r.get("amount_usd"), (String) r.get("stripe_price_id"),
                PlatformTenantService.instant(r.get("effective_from")), PlatformTenantService.instant(r.get("archived_at")))).toList();
        Long tenants = jdbc.queryForObject(
                "select count(distinct tenant_id) from tenant_addons where addon_id = ? and status = 'ACTIVE'", Long.class, addonId);
        return new CatalogItem(addonId, (String) a.get("code"), (String) a.get("name"), (String) a.get("description"),
                (String) a.get("resource_key"), ((Number) a.get("unit_quantity")).longValue(), (String) a.get("kind"),
                (Integer) a.get("validity_months"), TenantService.permissionCodes(a.get("plan_codes")),
                Boolean.TRUE.equals(a.get("is_active")), ((Number) a.get("sort_order")).intValue(), tenants == null ? 0 : tenants, prices);
    }

    /** El alta guarda los precios sin Stripe; «Publicar en Stripe» (createPrice) crea cada Price. */
    @Transactional
    public CatalogItem create(AddonCreate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        boolean consumable = "CONSUMABLE".equals(request.kind());
        if (consumable && !PlanLimitService.MAX_OCR_PAGES.equals(request.resourceKey())) {
            throw new IllegalArgumentException("Solo las páginas OCR se venden como paquete consumible");
        }
        if (consumable && request.validityMonths() == null) throw new IllegalArgumentException("Indica la validez del paquete en meses");
        Set<String> cycles = consumable ? Set.of("ONE_TIME") : Set.of("MONTHLY", "ANNUAL");
        if (!request.prices().keySet().equals(cycles)) {
            throw new IllegalArgumentException(consumable ? "Un paquete consumible tiene un precio ONE_TIME"
                    : "Un complemento recurrente necesita precio MONTHLY y ANNUAL");
        }
        request.prices().values().forEach(PlatformAddonService::validAmount);
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    insert into addons (id, code, name, description, resource_key, unit_quantity, kind, validity_months, plan_codes, sort_order)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, (select coalesce(max(sort_order), 0) + 1 from addons))
                    """, id, request.code(), request.name().trim(), blankToNull(request.description()), request.resourceKey(),
                    request.unitQuantity(), request.kind(), consumable ? request.validityMonths() : null,
                    validPlans(request.planCodes()).toArray(String[]::new));
        } catch (DuplicateKeyException duplicate) {
            throw new IllegalArgumentException("Ya existe un complemento con el código " + request.code());
        }
        request.prices().forEach((cycle, amount) -> jdbc.update(
                "insert into addon_prices (addon_id, billing_cycle, amount_usd, created_by) values (?, ?, ?, ?)",
                id, cycle, amount.setScale(2, RoundingMode.HALF_UP), audit.requirePlatformAccount().userId()));
        audit.record("ADDON_CREATED", null, reason, null, mapOf("addon", request.code(), "resource", request.resourceKey(),
                "unitQuantity", request.unitQuantity(), "kind", request.kind(), "plans", request.planCodes(), "prices", request.prices()));
        return item(id);
    }

    /** La cantidad por unidad y el recurso no cambian: modificarían lo que ya pagaron los clientes. */
    @Transactional
    public CatalogItem update(UUID addonId, AddonUpdate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        CatalogItem before = item(addonId);
        List<String> plans = validPlans(request.planCodes());
        jdbc.update("update addons set name = ?, description = ?, plan_codes = ?, is_active = ?, sort_order = ?, updated_at = now() where id = ?",
                request.name().trim(), blankToNull(request.description()), plans.toArray(String[]::new), request.active(),
                request.sortOrder(), addonId);
        audit.record("ADDON_UPDATED", null, reason,
                mapOf("addon", before.code(), "name", before.name(), "plans", before.planCodes(), "active", before.active()),
                mapOf("addon", before.code(), "name", request.name().trim(), "plans", plans, "active", request.active()));
        return item(addonId);
    }

    /**
     * Versión de precio nueva, o publicación en Stripe de la vigente si todavía no tiene Price (mismo monto).
     * Orden: Price en Stripe → base en una transacción → archivo del Price anterior en Stripe.
     */
    public CatalogItem createPrice(UUID addonId, AddonPrice request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        CatalogItem addon = item(addonId);
        String cycle = request.billingCycle();
        boolean consumable = "CONSUMABLE".equals(addon.kind());
        if (consumable != "ONE_TIME".equals(cycle)) {
            throw new IllegalArgumentException(consumable ? "Un paquete consumible solo tiene precio ONE_TIME" : "Un complemento recurrente tiene precio MONTHLY o ANNUAL");
        }
        BigDecimal amount = validAmount(request.amountUsd());
        PriceView current = addon.prices().stream().filter(p -> p.billingCycle().equals(cycle) && p.archivedAt() == null).findFirst().orElse(null);
        boolean publishOnly = current != null && current.stripePriceId() == null && amount.compareTo(current.amountUsd()) == 0;
        if (current != null && !publishOnly && amount.compareTo(current.amountUsd()) == 0) {
            throw new IllegalArgumentException("El precio nuevo es igual al vigente");
        }
        String previousStripe = current == null ? null : current.stripePriceId();
        String created = null;
        if (properties.configured()) {
            String product = previousStripe != null ? stripe.retrievePrice(previousStripe).path("product").asText() : productFor(addon);
            Map<String, String> form = new LinkedHashMap<>();
            form.put("product", product);
            form.put("currency", "usd");
            form.put("unit_amount", amount.movePointRight(2).toBigInteger().toString());
            if (!consumable) form.put("recurring[interval]", "ANNUAL".equals(cycle) ? "year" : "month");
            form.put("nickname", addon.name() + " " + cycle.toLowerCase(Locale.ROOT) + " " + amount);
            form.put("metadata[" + SubscriptionItems.ADDON_METADATA + "]", addon.code());
            created = stripe.createPrice(form, "nexodocs-addon-price-" + addonId + "-" + cycle + "-" + amount.toPlainString()
                    + "-" + (current == null ? "first" : current.id())).path("id").asText();
        } else if (publishOnly) {
            throw new IllegalStateException("Stripe no está configurado: no hay dónde publicar el precio");
        }
        String newStripe = created;
        UUID actor = audit.requirePlatformAccount().userId();
        try {
            transaction.executeWithoutResult(status -> {
                if (publishOnly) {
                    int updated = jdbc.update("update addon_prices set stripe_price_id = ? where id = ? and stripe_price_id is null and archived_at is null",
                            newStripe, current.id());
                    if (updated != 1) throw new IllegalStateException("El precio cambió mientras se publicaba; vuelve a intentarlo");
                } else {
                    if (current != null) {
                        int archived = jdbc.update("update addon_prices set archived_at = now() where id = ? and archived_at is null", current.id());
                        if (archived != 1) throw new IllegalStateException("El precio cambió mientras se creaba la versión nueva; vuelve a intentarlo");
                    }
                    jdbc.update("insert into addon_prices (addon_id, billing_cycle, amount_usd, stripe_price_id, created_by) values (?, ?, ?, ?, ?)",
                            addonId, cycle, amount, newStripe, actor);
                }
                audit.record("ADDON_PRICE_CHANGED", null, reason,
                        mapOf("addon", addon.code(), "billingCycle", cycle, "amountUsd", current == null ? null : current.amountUsd(),
                                "stripePriceId", previousStripe),
                        mapOf("addon", addon.code(), "billingCycle", cycle, "amountUsd", amount, "stripePriceId", newStripe,
                                "publishedOnly", publishOnly));
            });
        } catch (RuntimeException exception) {
            if (created != null) archiveStripePrice(created);
            throw exception;
        }
        if (previousStripe != null && !publishOnly) archiveStripePrice(previousStripe);
        return transaction.execute(status -> item(addonId));
    }

    // ---------------------------------------------------------------- cortesías

    @Transactional
    public void grantCourtesy(UUID tenantId, CourtesyGrant request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        if (!request.expiresAt().isAfter(Instant.now().plus(1, ChronoUnit.HOURS))) {
            throw new IllegalArgumentException("El vencimiento debe ser una fecha futura");
        }
        if (request.expiresAt().isAfter(Instant.now().plus(3 * 366, ChronoUnit.DAYS))) {
            throw new IllegalArgumentException("Una cortesía dura como máximo 3 años");
        }
        List<Map<String, Object>> tenants = jdbc.queryForList(
                "select id from tenants where id = ? and purged_at is null and subscription_status in ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED') for update",
                tenantId);
        if (tenants.isEmpty()) throw new IllegalStateException("La organización no está vigente");
        List<Map<String, Object>> addons = jdbc.queryForList(
                "select id, code, kind, unit_quantity from addons where code = ?", request.addonCode().trim().toUpperCase(Locale.ROOT));
        if (addons.isEmpty()) throw new NotFoundException("Complemento no encontrado");
        Map<String, Object> addon = addons.get(0);
        boolean consumable = "CONSUMABLE".equals(addon.get("kind"));
        UUID id = UUID.randomUUID();
        jdbc.update("""
                insert into tenant_addons (id, tenant_id, addon_id, units, source, remaining_quantity, expires_at, reason, granted_by)
                values (?, ?, ?, ?, 'COURTESY', ?, ?, ?, ?)
                """, id, tenantId, addon.get("id"), request.units(),
                consumable ? request.units() * ((Number) addon.get("unit_quantity")).longValue() : null,
                Timestamp.from(request.expiresAt()), reason, audit.requirePlatformAccount().userId());
        audit.record("TENANT_ADDON_GRANTED", tenantId, reason, null,
                mapOf("addon", addon.get("code"), "units", request.units(), "expiresAt", request.expiresAt().toString(), "tenantAddonId", id.toString()));
    }

    /** Solo cortesías: lo comprado se gestiona desde la suscripción del cliente. */
    @Transactional
    public void revokeCourtesy(UUID tenantId, UUID tenantAddonId, String reasonText) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select ta.id, ta.units, ta.expires_at, a.code from tenant_addons ta join addons a on a.id = ta.addon_id
                where ta.id = ? and ta.tenant_id = ? and ta.status = 'ACTIVE' and ta.source = 'COURTESY' for update of ta
                """, tenantAddonId, tenantId);
        if (rows.isEmpty()) throw new NotFoundException("Cortesía activa no encontrada");
        jdbc.update("update tenant_addons set status = 'ENDED', updated_at = now() where id = ?", tenantAddonId);
        Map<String, Object> row = rows.get(0);
        audit.record("TENANT_ADDON_REVOKED", tenantId, reason,
                mapOf("addon", row.get("code"), "units", row.get("units"), "expiresAt", String.valueOf(row.get("expires_at"))),
                mapOf("status", "ENDED"));
    }

    // --------------------------------------------------------------- utilidades

    private String productFor(CatalogItem addon) {
        return stripe.createProduct(Map.of("name", "NexoDocs " + addon.name(), "metadata[" + SubscriptionItems.ADDON_METADATA + "]", addon.code()),
                "nexodocs-addon-product-" + addon.code()).path("id").asText();
    }

    private void archiveStripePrice(String priceId) {
        try {
            stripe.updatePrice(priceId, Map.of("active", "false"));
        } catch (RuntimeException exception) {
            log.warn("No se pudo archivar el precio {} en Stripe: {}", priceId, exception.getMessage());
        }
    }

    private Map<String, Object> addon(UUID addonId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, code, name, description, resource_key, unit_quantity, kind, validity_months, plan_codes, is_active, sort_order
                from addons where id = ?
                """, addonId);
        if (rows.isEmpty()) throw new NotFoundException("Complemento no encontrado");
        return rows.get(0);
    }

    static List<String> validPlans(List<String> requested) {
        List<String> plans = requested.stream().filter(Objects::nonNull).map(p -> p.trim().toUpperCase(Locale.ROOT))
                .filter(p -> !p.isEmpty()).distinct().sorted().toList();
        List<String> unknown = plans.stream().filter(p -> !PLAN_CODES.contains(p)).toList();
        if (!unknown.isEmpty()) throw new IllegalArgumentException("Planes desconocidos: " + String.join(", ", unknown));
        return plans;
    }

    static BigDecimal validAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || amount.scale() > 2 && amount.stripTrailingZeros().scale() > 2) {
            throw new IllegalArgumentException("El precio debe ser mayor que 0 y tener como máximo dos decimales");
        }
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private static Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
