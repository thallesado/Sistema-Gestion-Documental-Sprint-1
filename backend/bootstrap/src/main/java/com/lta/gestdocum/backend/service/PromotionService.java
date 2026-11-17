package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lta.gestdocum.backend.dto.DiscountDtos.ActiveDiscount;
import com.lta.gestdocum.backend.dto.DiscountDtos.PromotionPreview;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Códigos promocionales en el checkout y descuentos de cada organización (065). Valida el código con
 * las reglas de NexoDocs antes de enviarlo a Stripe (que vuelve a validar vencimiento y canjes), registra
 * el canje cuando Stripe confirma el pago y refleja en la base cuándo Stripe deja de aplicar el descuento.
 * Lee y escribe con el usuario de conexión: nexodocs_app no tiene privilegios sobre los cupones.
 */
@Service
public class PromotionService {
    private static final Logger log = LoggerFactory.getLogger(PromotionService.class);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneOffset.UTC);

    private final JdbcTemplate jdbc;

    public PromotionService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Código válido para una compra: ids de Stripe y vista previa del primer cobro. */
    public record ResolvedCode(UUID promotionCodeId, String stripePromotionCodeId, PromotionPreview preview) { }

    /**
     * Comprueba el código para el plan y ciclo. tenantId es null en el alta pública (siempre primer pago).
     * Cada rechazo lleva un mensaje claro para el checkout.
     */
    public ResolvedCode resolve(String rawCode, String planCode, String cycle, UUID tenantId) {
        String code = normalize(rawCode);
        String plan = planCode == null ? "" : planCode.trim().toUpperCase(Locale.ROOT);
        String billing = "ANNUAL".equals(cycle) ? "ANNUAL" : "MONTHLY";
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select pc.id, pc.code, pc.stripe_promotion_code_id, pc.max_redemptions, pc.expires_at, pc.first_time_only,
                  pc.is_active as code_active, c.name, c.percent_off, c.amount_off_usd, c.duration, c.duration_in_months,
                  c.plan_codes, c.redeem_by, c.is_active as coupon_active,
                  (select count(*) from tenant_discounts td where td.promotion_code_id = pc.id) as redemptions
                from promotion_codes pc join coupons c on c.id = pc.coupon_id where pc.code = ?
                """, code);
        if (rows.isEmpty()) throw new IllegalArgumentException("El código promocional " + code + " no existe");
        Map<String, Object> r = rows.get(0);
        if (!Boolean.TRUE.equals(r.get("code_active")) || !Boolean.TRUE.equals(r.get("coupon_active"))) {
            throw new IllegalArgumentException("El código promocional " + code + " ya no está disponible");
        }
        Instant now = Instant.now();
        Instant expires = earliest(PlatformTenantService.instant(r.get("expires_at")), PlatformTenantService.instant(r.get("redeem_by")));
        if (!expires.isAfter(now)) {
            throw new IllegalArgumentException("El código promocional " + code + " venció el " + DAY.format(expires));
        }
        Integer max = (Integer) r.get("max_redemptions");
        if (max != null && ((Number) r.get("redemptions")).longValue() >= max) {
            throw new IllegalArgumentException("El código promocional " + code + " ya alcanzó su límite de canjes");
        }
        List<String> plans = TenantService.permissionCodes(r.get("plan_codes"));
        if (!plans.contains(plan)) {
            throw new IllegalArgumentException("El código promocional " + code + " no se aplica al plan " + plan);
        }
        if (tenantId != null) {
            if (Boolean.TRUE.equals(r.get("first_time_only")) && hasPaid(tenantId)) {
                throw new IllegalArgumentException("El código promocional " + code + " es solo para el primer pago");
            }
            if (activeDiscount(tenantId) != null) {
                throw new IllegalArgumentException("La organización ya tiene un descuento vigente");
            }
        }
        if (r.get("stripe_promotion_code_id") == null) {
            throw new IllegalArgumentException("El código promocional " + code + " no está publicado en Stripe");
        }
        BigDecimal price = planPrice(plan, billing);
        BigDecimal percent = (BigDecimal) r.get("percent_off");
        BigDecimal amount = (BigDecimal) r.get("amount_off_usd");
        PromotionPreview preview = new PromotionPreview(code, (String) r.get("name"), percent, amount, (String) r.get("duration"),
                (Integer) r.get("duration_in_months"), price, discounted(price, percent, amount));
        return new ResolvedCode((UUID) r.get("id"), (String) r.get("stripe_promotion_code_id"), preview);
    }

    /**
     * Canje confirmado por Stripe (checkout pagado). Idempotente por sesión; ON CONFLICT sin destino
     * también evita abortar la transacción del alta si la organización ya tenía un descuento vigente.
     */
    public void recordRedemption(UUID tenantId, String promotionCodeId, String checkoutId, String subscriptionId,
                                 Instant periodEnd, String cycle) {
        if (promotionCodeId == null || promotionCodeId.isBlank()) return;
        UUID codeId;
        try { codeId = UUID.fromString(promotionCodeId); }
        catch (IllegalArgumentException invalid) { return; }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select c.id, c.duration, c.duration_in_months from promotion_codes pc join coupons c on c.id = pc.coupon_id
                where pc.id = ?
                """, codeId);
        if (rows.isEmpty()) return;
        Map<String, Object> c = rows.get(0);
        Instant start = Instant.now();
        Instant end = discountEnd((String) c.get("duration"), (Integer) c.get("duration_in_months"), start, periodEnd, cycle);
        endExpired(tenantId);
        int inserted = jdbc.update("""
                insert into tenant_discounts (tenant_id, coupon_id, promotion_code_id, source, starts_at, ends_at,
                  stripe_subscription_id, stripe_checkout_id)
                values (?, ?, ?, 'PROMOTION_CODE', ?, ?, ?, ?)
                on conflict do nothing
                """, tenantId, c.get("id"), codeId, Timestamp.from(start), Timestamp.from(end), subscriptionId, checkoutId);
        if (inserted == 0) log.info("Canje del código {} para {} ya registrado o con otro descuento vigente", codeId, tenantId);
    }

    /** Descuento vigente para la pantalla «Gestionar suscripción»; null si no hay o si la base no tiene 065. */
    public ActiveDiscount activeDiscount(UUID tenantId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList("""
                    select c.name, c.percent_off, c.amount_off_usd, c.duration, c.duration_in_months, td.starts_at, td.ends_at, td.source
                    from tenant_discounts td join coupons c on c.id = td.coupon_id
                    where td.tenant_id = ? and td.status = 'ACTIVE' and td.ends_at > now()
                    order by td.starts_at desc limit 1
                    """, tenantId);
            if (rows.isEmpty()) return null;
            Map<String, Object> r = rows.get(0);
            return new ActiveDiscount((String) r.get("name"), (BigDecimal) r.get("percent_off"), (BigDecimal) r.get("amount_off_usd"),
                    (String) r.get("duration"), (Integer) r.get("duration_in_months"), PlatformTenantService.instant(r.get("starts_at")),
                    PlatformTenantService.instant(r.get("ends_at")), (String) r.get("source"));
        } catch (DataAccessException missing) {
            return null;
        }
    }

    /**
     * Si la suscripción de Stripe ya no tiene descuento (cupón de un solo pago cobrado, o quitado desde
     * Stripe), el descuento vigente termina. Se ignoran los recién creados: el webhook puede traer el
     * estado anterior a su aplicación. Sin los campos de descuento en el objeto no se cambia nada.
     */
    public void syncFromSubscription(UUID tenantId, JsonNode subscription) {
        JsonNode discounts = subscription.get("discounts");
        JsonNode legacy = subscription.get("discount");
        if (discounts == null && legacy == null) return;
        boolean hasDiscount = (discounts != null && discounts.isArray() && !discounts.isEmpty())
                || (legacy != null && !legacy.isNull());
        if (hasDiscount) return;
        try {
            jdbc.update("""
                    update tenant_discounts set status = 'ENDED', ends_at = greatest(starts_at + interval '1 second', least(ends_at, now()))
                    where tenant_id = ? and status = 'ACTIVE' and stripe_subscription_id is not null
                      and starts_at < now() - interval '2 minutes'
                    """, tenantId);
        } catch (DataAccessException exception) {
            log.warn("No se pudo sincronizar el descuento de {}: {}", tenantId, exception.getMessage());
        }
    }

    /** Metadata de la factura: monto descontado y descuento de la organización al que se atribuye. */
    public Map<String, Object> invoiceAttribution(UUID tenantId, JsonNode invoice) {
        long cents = 0;
        for (JsonNode item : invoice.path("total_discount_amounts")) cents += item.path("amount").asLong(0);
        if (cents <= 0) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("discountUsd", BigDecimal.valueOf(cents).movePointLeft(2));
        try {
            List<UUID> ids = jdbc.queryForList("""
                    select id from tenant_discounts where tenant_id = ? and starts_at <= now() + interval '5 minutes'
                    order by starts_at desc limit 1
                    """, UUID.class, tenantId);
            if (!ids.isEmpty()) out.put("tenantDiscountId", ids.get(0).toString());
        } catch (DataAccessException missing) {
            // base sin 065: solo se guarda el monto
        }
        return out;
    }

    void endExpired(UUID tenantId) {
        jdbc.update("update tenant_discounts set status = 'ENDED' where tenant_id = ? and status = 'ACTIVE' and ends_at <= now()", tenantId);
    }

    private boolean hasPaid(UUID tenantId) {
        Long paid = jdbc.queryForObject("select count(*) from billing_transactions where tenant_id = ? and status = 'COMPLETED'",
                Long.class, tenantId);
        return paid != null && paid > 0;
    }

    private BigDecimal planPrice(String plan, String cycle) {
        List<BigDecimal> prices = jdbc.queryForList(
                "select " + ("ANNUAL".equals(cycle) ? "price_yearly" : "price_monthly") + " from plans where upper(code) = ? and is_active",
                BigDecimal.class, plan);
        return prices.isEmpty() || prices.get(0) == null ? BigDecimal.ZERO : prices.get(0);
    }

    // ------------------------------------------------------------ reglas puras

    /** Precio con el descuento aplicado, nunca negativo. */
    static BigDecimal discounted(BigDecimal price, BigDecimal percentOff, BigDecimal amountOff) {
        if (price == null) return BigDecimal.ZERO;
        BigDecimal result = percentOff != null
                ? price.subtract(price.multiply(percentOff).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP))
                : amountOff != null ? price.subtract(amountOff) : price;
        return result.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    /** Fin del descuento: un solo pago dura el período cobrado; REPEATING, N meses desde el inicio. */
    static Instant discountEnd(String duration, Integer months, Instant start, Instant periodEnd, String cycle) {
        if ("REPEATING".equals(duration) && months != null) {
            return start.atZone(ZoneOffset.UTC).plusMonths(months).toInstant();
        }
        if (periodEnd != null && periodEnd.isAfter(start.plus(1, ChronoUnit.HOURS))) return periodEnd;
        return start.atZone(ZoneOffset.UTC).plusMonths("ANNUAL".equals(cycle) ? 12 : 1).toInstant();
    }

    static String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private static Instant earliest(Instant a, Instant b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isBefore(b) ? a : b;
    }
}
