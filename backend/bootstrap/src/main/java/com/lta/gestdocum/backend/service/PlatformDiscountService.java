package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.DiscountDtos.*;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.security.PlatformAuthorities;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Cupones, códigos promocionales y descuentos aprobados por la plataforma (065). Stripe primero:
 * si Stripe falla no se guarda nada; si falla la base, se deshace en Stripe lo recién creado. Todo
 * descuento tiene fecha de fin y un tope; cada acción exige motivo y queda en platform_audit_events.
 */
@Service
public class PlatformDiscountService {
    private static final Logger log = LoggerFactory.getLogger(PlatformDiscountService.class);
    private static final int MAX_REDEMPTIONS_LISTED = 200;

    private final JdbcTemplate jdbc;
    private final PlatformAuditService audit;
    private final StripeApiClient stripe;
    private final StripeBillingProperties properties;
    private final TransactionTemplate transaction;
    private final BigDecimal maxPercentOff;
    private final int loyaltyMonths;
    /** Por encima de este porcentaje, aplicar un descuento a una organización requiere a Finanzas (066). */
    @Value("${app.discounts.finance-approval-percent:20}")
    BigDecimal financeApprovalPercent = new BigDecimal("20");

    public PlatformDiscountService(JdbcTemplate jdbc, PlatformAuditService audit, StripeApiClient stripe,
                                   StripeBillingProperties properties, PlatformTransactionManager transactionManager,
                                   @Value("${app.discounts.max-percent-off:50}") BigDecimal maxPercentOff,
                                   @Value("${app.discounts.loyalty-months:12}") int loyaltyMonths) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.stripe = stripe;
        this.properties = properties;
        this.transaction = new TransactionTemplate(transactionManager);
        this.maxPercentOff = maxPercentOff;
        this.loyaltyMonths = loyaltyMonths;
    }

    // ------------------------------------------------------------------ consulta

    public DiscountsOverview overview() {
        audit.requirePlatformAccount();
        return transaction.execute(status -> {
            endExpired();
            Map<UUID, Map<String, Object>> stats = new HashMap<>();
            jdbc.queryForList("""
                    select td.coupon_id, count(*) as redemptions,
                      count(*) filter (where td.status = 'ACTIVE' and td.ends_at > now()) as active,
                      coalesce(sum(b.discounted), 0) as discounted, coalesce(sum(b.revenue), 0) as revenue
                    from tenant_discounts td
                    left join lateral (
                      select sum((bt.metadata_json->>'discountUsd')::numeric) as discounted, sum(bt.amount_usd) as revenue
                      from billing_transactions bt
                      where bt.tenant_id = td.tenant_id and bt.status = 'COMPLETED' and bt.metadata_json->>'tenantDiscountId' = td.id::text
                    ) b on true
                    group by td.coupon_id
                    """).forEach(r -> stats.put((UUID) r.get("coupon_id"), r));
            Map<UUID, List<PromotionCodeView>> codes = new HashMap<>();
            jdbc.queryForList("""
                    select pc.id, pc.coupon_id, pc.code, pc.max_redemptions, pc.expires_at, pc.first_time_only, pc.is_active,
                      pc.stripe_promotion_code_id, (select count(*) from tenant_discounts td where td.promotion_code_id = pc.id) as redemptions
                    from promotion_codes pc order by pc.created_at desc
                    """).forEach(r -> codes.computeIfAbsent((UUID) r.get("coupon_id"), k -> new ArrayList<>()).add(new PromotionCodeView(
                    (UUID) r.get("id"), (String) r.get("code"), (Integer) r.get("max_redemptions"), number(r.get("redemptions")),
                    PlatformTenantService.instant(r.get("expires_at")), Boolean.TRUE.equals(r.get("first_time_only")),
                    Boolean.TRUE.equals(r.get("is_active")) && PlatformTenantService.instant(r.get("expires_at")).isAfter(Instant.now()),
                    r.get("stripe_promotion_code_id") != null)));
            List<CouponView> coupons = jdbc.queryForList("""
                    select id, code, name, percent_off, amount_off_usd, duration, duration_in_months, plan_codes, redeem_by,
                      is_active, stripe_coupon_id from coupons order by is_active desc, created_at desc
                    """).stream().map(r -> {
                UUID id = (UUID) r.get("id");
                Map<String, Object> s = stats.getOrDefault(id, Map.of());
                Instant redeemBy = PlatformTenantService.instant(r.get("redeem_by"));
                return new CouponView(id, (String) r.get("code"), (String) r.get("name"), (BigDecimal) r.get("percent_off"),
                        (BigDecimal) r.get("amount_off_usd"), (String) r.get("duration"), (Integer) r.get("duration_in_months"),
                        TenantService.permissionCodes(r.get("plan_codes")), redeemBy,
                        Boolean.TRUE.equals(r.get("is_active")) && redeemBy.isAfter(Instant.now()), r.get("stripe_coupon_id") != null,
                        number(s.get("redemptions")), number(s.get("active")), money(s.get("discounted")), money(s.get("revenue")),
                        List.copyOf(codes.getOrDefault(id, List.of())));
            }).toList();
            return new DiscountsOverview(maxPercentOff, loyaltyMonths, coupons);
        });
    }

    public List<Redemption> redemptions() {
        audit.requirePlatformAccount();
        return transaction.execute(status -> {
            endExpired();
            return jdbc.queryForList("""
                    select td.id, td.tenant_id, t.name as tenant_name, c.code as coupon_code, pc.code as promotion_code, td.source,
                      td.status, td.starts_at, td.ends_at, td.reason, u.username as approved_by,
                      (select coalesce(sum((bt.metadata_json->>'discountUsd')::numeric), 0) from billing_transactions bt
                        where bt.tenant_id = td.tenant_id and bt.status = 'COMPLETED'
                          and bt.metadata_json->>'tenantDiscountId' = td.id::text) as discounted
                    from tenant_discounts td join tenants t on t.id = td.tenant_id join coupons c on c.id = td.coupon_id
                    left join promotion_codes pc on pc.id = td.promotion_code_id left join users u on u.id = td.approved_by
                    order by td.starts_at desc limit ?
                    """, MAX_REDEMPTIONS_LISTED).stream().map(r -> new Redemption((UUID) r.get("id"), (UUID) r.get("tenant_id"),
                    (String) r.get("tenant_name"), (String) r.get("coupon_code"), (String) r.get("promotion_code"), (String) r.get("source"),
                    (String) r.get("status"), PlatformTenantService.instant(r.get("starts_at")), PlatformTenantService.instant(r.get("ends_at")),
                    (String) r.get("reason"), (String) r.get("approved_by"), money(r.get("discounted")))).toList();
        });
    }

    /**
     * Clientes frecuentes: suscripción de Stripe activa, primer pago hace al menos loyaltyMonths meses, sin
     * pagos fallidos en ese período y sin descuento vigente. Solo se sugieren: el admin aprueba cada uno.
     */
    public List<LoyaltyCandidate> candidates() {
        audit.requirePlatformAccount();
        return jdbc.queryForList("""
                select t.id, t.name, p.code as plan_code, p.name as plan_name, t.billing_cycle_v2,
                  min(b.completed_at) filter (where b.status = 'COMPLETED') as first_payment,
                  count(*) filter (where b.status = 'COMPLETED') as payments,
                  coalesce(sum(b.amount_usd) filter (where b.status = 'COMPLETED'), 0) as total_paid
                from tenants t join plans p on p.id = t.plan_id join billing_transactions b on b.tenant_id = t.id
                where t.subscription_status = 'ACTIVE' and t.stripe_subscription_id is not null and t.purged_at is null
                  and coalesce(t.stripe_subscription_status, 'active') = 'active'
                  and not exists (select 1 from tenant_discounts td where td.tenant_id = t.id and td.status = 'ACTIVE' and td.ends_at > now())
                group by t.id, t.name, p.code, p.name, t.billing_cycle_v2
                having min(b.completed_at) filter (where b.status = 'COMPLETED') <= now() - make_interval(months => ?)
                  and count(*) filter (where b.status = 'FAILED' and b.created_at > now() - make_interval(months => ?)) = 0
                order by first_payment limit 100
                """, loyaltyMonths, loyaltyMonths).stream().map(r -> {
            Instant first = PlatformTenantService.instant(r.get("first_payment"));
            long months = first == null ? 0 : ChronoUnit.MONTHS.between(first.atZone(java.time.ZoneOffset.UTC), Instant.now().atZone(java.time.ZoneOffset.UTC));
            return new LoyaltyCandidate((UUID) r.get("id"), (String) r.get("name"), (String) r.get("plan_code"), (String) r.get("plan_name"),
                    Objects.toString(r.get("billing_cycle_v2"), "MONTHLY"), first, months, number(r.get("payments")), money(r.get("total_paid")));
        }).toList();
    }

    // ------------------------------------------------------------------ cupones

    public void createCoupon(CouponCreate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        List<String> plans = PlatformAddonService.validPlans(request.planCodes());
        if (plans.isEmpty()) throw new IllegalArgumentException("Elige al menos un plan al que se aplica el cupón");
        validateCoupon(request.percentOff(), request.amountOffUsd(), request.duration(), request.durationInMonths(),
                request.redeemBy(), maxPercentOff, lowestMonthlyPrice(plans));
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (exists("select count(*) from coupons where code = ?", code)) throw new IllegalArgumentException("Ya existe un cupón con el código " + code);
        requireStripe();

        Map<String, String> form = new LinkedHashMap<>();
        form.put("name", request.name().trim());
        if (request.percentOff() != null) form.put("percent_off", request.percentOff().stripTrailingZeros().toPlainString());
        else {
            form.put("amount_off", request.amountOffUsd().movePointRight(2).setScale(0, RoundingMode.HALF_UP).toPlainString());
            form.put("currency", "usd");
        }
        form.put("duration", request.duration().toLowerCase(Locale.ROOT));
        if ("REPEATING".equals(request.duration())) form.put("duration_in_months", request.durationInMonths().toString());
        form.put("redeem_by", Long.toString(request.redeemBy().getEpochSecond()));
        form.put("metadata[nexodocsCoupon]", code);
        form.put("metadata[plans]", String.join(",", plans));
        String stripeCoupon = stripe.createCoupon(form, "nexodocs-coupon-" + code).path("id").asText();
        UUID actor = audit.requirePlatformAccount().userId();
        try {
            transaction.executeWithoutResult(status -> {
                jdbc.update("""
                        insert into coupons (code, name, percent_off, amount_off_usd, duration, duration_in_months, plan_codes,
                          redeem_by, stripe_coupon_id, created_by)
                        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, code, request.name().trim(), scale(request.percentOff()), scale(request.amountOffUsd()), request.duration(),
                        "REPEATING".equals(request.duration()) ? request.durationInMonths() : null, plans.toArray(String[]::new),
                        Timestamp.from(request.redeemBy()), stripeCoupon, actor);
                audit.record("COUPON_CREATED", null, reason, null, mapOf("coupon", code, "percentOff", request.percentOff(),
                        "amountOffUsd", request.amountOffUsd(), "duration", request.duration(), "durationInMonths", request.durationInMonths(),
                        "plans", plans, "redeemBy", request.redeemBy().toString(), "stripeCouponId", stripeCoupon));
            });
        } catch (RuntimeException exception) {
            deleteStripeCoupon(stripeCoupon);
            if (exception instanceof DuplicateKeyException) throw new IllegalArgumentException("Ya existe un cupón con el código " + code);
            throw exception;
        }
    }

    /** Retira el cupón y sus códigos para canjes nuevos; los descuentos ya aplicados siguen hasta su fin. */
    public void deactivateCoupon(UUID couponId, String reasonText) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        Map<String, Object> coupon = coupon(couponId);
        if (!Boolean.TRUE.equals(coupon.get("is_active"))) throw new IllegalStateException("El cupón ya está retirado");
        String stripeCoupon = (String) coupon.get("stripe_coupon_id");
        if (stripeCoupon != null) stripe.deleteCoupon(stripeCoupon);
        List<String> stripeCodes = new ArrayList<>();
        transaction.executeWithoutResult(status -> {
            jdbc.update("update coupons set is_active = false, deactivated_at = now() where id = ?", couponId);
            stripeCodes.addAll(jdbc.queryForList("""
                    update promotion_codes set is_active = false, deactivated_at = now() where coupon_id = ? and is_active
                    returning stripe_promotion_code_id
                    """, String.class, couponId).stream().filter(Objects::nonNull).toList());
            audit.record("COUPON_DEACTIVATED", null, reason, mapOf("coupon", coupon.get("code"), "active", true),
                    mapOf("coupon", coupon.get("code"), "active", false, "promotionCodesDeactivated", stripeCodes.size()));
        });
        stripeCodes.forEach(this::deactivateStripeCode);
    }

    // --------------------------------------------------------- códigos promocionales

    public void createPromotionCode(UUID couponId, PromotionCodeCreate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        Map<String, Object> coupon = coupon(couponId);
        if (!Boolean.TRUE.equals(coupon.get("is_active")) || coupon.get("stripe_coupon_id") == null) {
            throw new IllegalStateException("El cupón no está disponible para crear códigos");
        }
        Instant redeemBy = PlatformTenantService.instant(coupon.get("redeem_by"));
        validatePromotionCode(request.expiresAt(), redeemBy);
        String code = PromotionService.normalize(request.code());
        if (exists("select count(*) from promotion_codes where code = ?", code)) {
            throw new IllegalArgumentException("Ya existe el código promocional " + code);
        }
        requireStripe();
        Map<String, String> form = new LinkedHashMap<>();
        form.put("code", code);
        form.put("expires_at", Long.toString(request.expiresAt().getEpochSecond()));
        if (request.maxRedemptions() != null) form.put("max_redemptions", request.maxRedemptions().toString());
        form.put("restrictions[first_time_transaction]", Boolean.toString(request.firstTimeOnly()));
        form.put("metadata[nexodocsCoupon]", (String) coupon.get("code"));
        String stripeCode = stripe.createPromotionCode((String) coupon.get("stripe_coupon_id"), form,
                "nexodocs-promotion-code-" + code).path("id").asText();
        UUID actor = audit.requirePlatformAccount().userId();
        try {
            transaction.executeWithoutResult(status -> {
                jdbc.update("""
                        insert into promotion_codes (coupon_id, code, stripe_promotion_code_id, max_redemptions, expires_at,
                          first_time_only, created_by)
                        values (?, ?, ?, ?, ?, ?, ?)
                        """, couponId, code, stripeCode, request.maxRedemptions(), Timestamp.from(request.expiresAt()),
                        request.firstTimeOnly(), actor);
                audit.record("PROMOTION_CODE_CREATED", null, reason, null, mapOf("coupon", coupon.get("code"), "code", code,
                        "maxRedemptions", request.maxRedemptions(), "expiresAt", request.expiresAt().toString(),
                        "firstTimeOnly", request.firstTimeOnly(), "stripePromotionCodeId", stripeCode));
            });
        } catch (RuntimeException exception) {
            deactivateStripeCode(stripeCode);
            if (exception instanceof DuplicateKeyException) throw new IllegalArgumentException("Ya existe el código promocional " + code);
            throw exception;
        }
    }

    public void deactivatePromotionCode(UUID promotionCodeId, String reasonText) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select code, stripe_promotion_code_id, is_active from promotion_codes where id = ?", promotionCodeId);
        if (rows.isEmpty()) throw new NotFoundException("Código promocional no encontrado");
        Map<String, Object> row = rows.get(0);
        if (!Boolean.TRUE.equals(row.get("is_active"))) throw new IllegalStateException("El código ya está desactivado");
        if (row.get("stripe_promotion_code_id") != null) {
            stripe.updatePromotionCode((String) row.get("stripe_promotion_code_id"), Map.of("active", "false"));
        }
        transaction.executeWithoutResult(status -> {
            jdbc.update("update promotion_codes set is_active = false, deactivated_at = now() where id = ?", promotionCodeId);
            audit.record("PROMOTION_CODE_DEACTIVATED", null, reason, mapOf("code", row.get("code"), "active", true),
                    mapOf("code", row.get("code"), "active", false));
        });
    }

    // ---------------------------------------------------- descuento a una organización

    /**
     * Descuento aprobado por el admin (cliente frecuente o caso puntual) sobre la suscripción de Stripe.
     * Nunca se aplica solo: el admin es el aprobador y el motivo queda en la auditoría.
     */
    public void applyToTenant(UUID tenantId, TenantDiscountApply request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        Map<String, Object> coupon = coupon(request.couponId());
        Instant redeemBy = PlatformTenantService.instant(coupon.get("redeem_by"));
        if (!Boolean.TRUE.equals(coupon.get("is_active")) || !redeemBy.isAfter(Instant.now()) || coupon.get("stripe_coupon_id") == null) {
            throw new IllegalStateException("El cupón no está disponible");
        }
        List<Map<String, Object>> tenants = jdbc.queryForList("""
                select t.subscription_status::text as status, t.stripe_subscription_id, t.current_period_end, t.billing_cycle_v2,
                  p.code as plan_code from tenants t left join plans p on p.id = t.plan_id where t.id = ? and t.purged_at is null
                """, tenantId);
        if (tenants.isEmpty()) throw new NotFoundException("Organización no encontrada");
        Map<String, Object> t = tenants.get(0);
        if (!"ACTIVE".equals(t.get("status")) || t.get("stripe_subscription_id") == null) {
            throw new IllegalStateException("El descuento se aplica a organizaciones activas que pagan con Stripe");
        }
        String plan = Objects.toString(t.get("plan_code"), "").toUpperCase(Locale.ROOT);
        if (!TenantService.permissionCodes(coupon.get("plan_codes")).contains(plan)) {
            throw new IllegalArgumentException("El cupón no se aplica al plan " + plan);
        }
        BigDecimal effective = effectivePercent((BigDecimal) coupon.get("percent_off"), (BigDecimal) coupon.get("amount_off_usd"),
                jdbc.queryForObject("select price_monthly from plans where upper(code) = ?", BigDecimal.class, plan));
        if (needsFinanceApproval(effective, financeApprovalPercent)
                && !audit.requirePlatformAccount().authorities().contains(PlatformAuthorities.DISCOUNT_APPROVE)) {
            throw new org.springframework.security.access.AccessDeniedException("Un descuento mayor que "
                    + financeApprovalPercent.stripTrailingZeros().toPlainString() + " % requiere la aprobación de Finanzas");
        }
        transaction.executeWithoutResult(status -> jdbc.update(
                "update tenant_discounts set status = 'ENDED' where tenant_id = ? and status = 'ACTIVE' and ends_at <= now()", tenantId));
        if (exists("select count(*) from tenant_discounts where tenant_id = ? and status = 'ACTIVE'", tenantId)) {
            throw new IllegalStateException("La organización ya tiene un descuento vigente: retíralo antes de aplicar otro");
        }
        boolean loyalty = candidates().stream().anyMatch(c -> c.tenantId().equals(tenantId));
        String subscription = (String) t.get("stripe_subscription_id");
        JsonNode updated = stripe.updateSubscription(subscription, Map.of("discounts[0][coupon]", (String) coupon.get("stripe_coupon_id")));
        Instant start = Instant.now();
        Instant end = PromotionService.discountEnd((String) coupon.get("duration"), (Integer) coupon.get("duration_in_months"), start,
                PlatformTenantService.instant(t.get("current_period_end")), (String) t.get("billing_cycle_v2"));
        UUID actor = audit.requirePlatformAccount().userId();
        try {
            transaction.executeWithoutResult(status -> {
                jdbc.update("""
                        insert into tenant_discounts (tenant_id, coupon_id, source, reason, approved_by, starts_at, ends_at, stripe_subscription_id)
                        values (?, ?, ?, ?, ?, ?, ?, ?)
                        """, tenantId, request.couponId(), loyalty ? "LOYALTY" : "MANUAL", reason, actor, Timestamp.from(start),
                        Timestamp.from(end), subscription);
                audit.record("TENANT_DISCOUNT_APPLIED", tenantId, reason, null, mapOf("coupon", coupon.get("code"),
                        "percentOff", coupon.get("percent_off"), "amountOffUsd", coupon.get("amount_off_usd"),
                        "source", loyalty ? "LOYALTY" : "MANUAL", "endsAt", end.toString(),
                        "approvedBy", audit.requirePlatformAccount().username(), "stripeSubscriptionStatus", updated.path("status").asText()));
            });
        } catch (RuntimeException exception) {
            clearStripeDiscounts(subscription);
            if (exception instanceof DuplicateKeyException) throw new IllegalStateException("La organización ya tiene un descuento vigente");
            throw exception;
        }
    }

    public void removeFromTenant(UUID tenantId, UUID discountId, String reasonText) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select td.stripe_subscription_id, td.ends_at, td.source, c.code from tenant_discounts td join coupons c on c.id = td.coupon_id
                where td.id = ? and td.tenant_id = ? and td.status = 'ACTIVE'
                """, discountId, tenantId);
        if (rows.isEmpty()) throw new NotFoundException("Descuento vigente no encontrado");
        Map<String, Object> row = rows.get(0);
        if (row.get("stripe_subscription_id") != null) {
            stripe.updateSubscription((String) row.get("stripe_subscription_id"), Map.of("discounts", ""));
        }
        transaction.executeWithoutResult(status -> {
            jdbc.update("""
                    update tenant_discounts set status = 'REMOVED', removed_at = now(),
                      ends_at = greatest(starts_at + interval '1 second', least(ends_at, now()))
                    where id = ? and status = 'ACTIVE'
                    """, discountId);
            audit.record("TENANT_DISCOUNT_REMOVED", tenantId, reason,
                    mapOf("coupon", row.get("code"), "source", row.get("source"), "endsAt", String.valueOf(row.get("ends_at"))),
                    mapOf("status", "REMOVED"));
        });
    }

    // ------------------------------------------------------------ reglas puras

    /**
     * Reglas del cupón: un solo tipo de valor, duración con fin (un pago o 1 a 36 meses), fecha límite
     * de canje futura y como máximo a dos años, y el tope: porcentaje ≤ maxPercent; un monto fijo no puede
     * superar ese porcentaje del precio mensual más bajo de los planes a los que se aplica.
     */
    static void validateCoupon(BigDecimal percentOff, BigDecimal amountOffUsd, String duration, Integer months, Instant redeemBy,
                               BigDecimal maxPercent, BigDecimal lowestMonthlyPrice) {
        if ((percentOff == null) == (amountOffUsd == null)) {
            throw new IllegalArgumentException("Indica un porcentaje o un monto fijo, no ambos");
        }
        if ("REPEATING".equals(duration) && (months == null || months < 1 || months > 36)) {
            throw new IllegalArgumentException("Indica la duración del descuento en meses (1 a 36)");
        }
        if (!"ONCE".equals(duration) && !"REPEATING".equals(duration)) {
            throw new IllegalArgumentException("El descuento debe terminar: un solo pago o un número de meses");
        }
        if (redeemBy == null || !redeemBy.isAfter(Instant.now().plus(1, ChronoUnit.HOURS))) {
            throw new IllegalArgumentException("La fecha de fin del cupón es obligatoria y debe ser futura");
        }
        if (redeemBy.isAfter(Instant.now().plus(2 * 366, ChronoUnit.DAYS))) {
            throw new IllegalArgumentException("La fecha de fin del cupón no puede superar dos años");
        }
        if (percentOff != null) {
            if (percentOff.signum() <= 0 || percentOff.compareTo(maxPercent) > 0) {
                throw new IllegalArgumentException("El descuento supera el tope de " + maxPercent.stripTrailingZeros().toPlainString() + " %");
            }
            return;
        }
        if (amountOffUsd.signum() <= 0) throw new IllegalArgumentException("El monto del descuento debe ser mayor que 0");
        if (lowestMonthlyPrice == null || lowestMonthlyPrice.signum() <= 0) {
            throw new IllegalArgumentException("Los planes elegidos no tienen precio: usa un descuento en porcentaje");
        }
        BigDecimal cap = lowestMonthlyPrice.multiply(maxPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.DOWN);
        if (amountOffUsd.compareTo(cap) > 0) {
            throw new IllegalArgumentException("El descuento supera el tope de " + maxPercent.stripTrailingZeros().toPlainString()
                    + " % del plan más barato (máximo USD " + cap.toPlainString() + ")");
        }
    }

    /** Porcentaje equivalente del cupón sobre el precio mensual del plan (un monto fijo se compara con él). */
    static BigDecimal effectivePercent(BigDecimal percentOff, BigDecimal amountOffUsd, BigDecimal monthlyPrice) {
        if (percentOff != null) return percentOff;
        if (amountOffUsd == null) return BigDecimal.ZERO;
        if (monthlyPrice == null || monthlyPrice.signum() <= 0) return BigDecimal.valueOf(100);
        return amountOffUsd.multiply(BigDecimal.valueOf(100)).divide(monthlyPrice, 2, RoundingMode.HALF_UP);
    }

    static boolean needsFinanceApproval(BigDecimal effectivePercent, BigDecimal threshold) {
        return effectivePercent.compareTo(threshold) > 0;
    }

    static void validatePromotionCode(Instant expiresAt, Instant couponRedeemBy) {
        if (expiresAt == null || !expiresAt.isAfter(Instant.now().plus(1, ChronoUnit.HOURS))) {
            throw new IllegalArgumentException("El vencimiento del código es obligatorio y debe ser futuro");
        }
        if (couponRedeemBy != null && expiresAt.isAfter(couponRedeemBy)) {
            throw new IllegalArgumentException("El código no puede vencer después que su cupón");
        }
    }

    // --------------------------------------------------------------- utilidades

    private void endExpired() {
        jdbc.update("update tenant_discounts set status = 'ENDED' where status = 'ACTIVE' and ends_at <= now()");
    }

    private BigDecimal lowestMonthlyPrice(List<String> plans) {
        return jdbc.queryForObject("select min(price_monthly) from plans where upper(code) = any(?) and price_monthly > 0",
                BigDecimal.class, (Object) plans.toArray(String[]::new));
    }

    private Map<String, Object> coupon(UUID couponId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, code, name, percent_off, amount_off_usd, duration, duration_in_months, plan_codes, redeem_by,
                  stripe_coupon_id, is_active from coupons where id = ?
                """, couponId);
        if (rows.isEmpty()) throw new NotFoundException("Cupón no encontrado");
        return rows.get(0);
    }

    private boolean exists(String sql, Object arg) {
        Long count = jdbc.queryForObject(sql, Long.class, arg);
        return count != null && count > 0;
    }

    private void requireStripe() {
        if (!properties.configured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe no está configurado: los descuentos se crean en Stripe");
        }
    }

    private void deleteStripeCoupon(String couponId) {
        try { stripe.deleteCoupon(couponId); }
        catch (RuntimeException exception) { log.warn("No se pudo borrar el cupón {} en Stripe: {}", couponId, exception.getMessage()); }
    }

    private void deactivateStripeCode(String promotionCodeId) {
        try { stripe.updatePromotionCode(promotionCodeId, Map.of("active", "false")); }
        catch (RuntimeException exception) { log.warn("No se pudo desactivar el código {} en Stripe: {}", promotionCodeId, exception.getMessage()); }
    }

    private void clearStripeDiscounts(String subscriptionId) {
        try { stripe.updateSubscription(subscriptionId, Map.of("discounts", "")); }
        catch (RuntimeException exception) { log.error("No se pudo revertir el descuento de {} en Stripe: {}", subscriptionId, exception.getMessage()); }
    }

    private static BigDecimal scale(BigDecimal value) { return value == null ? null : value.setScale(2, RoundingMode.HALF_UP); }

    private static long number(Object value) { return value == null ? 0 : ((Number) value).longValue(); }

    private static BigDecimal money(Object value) {
        return value == null ? BigDecimal.ZERO.setScale(2) : new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP);
    }

    private static Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }
}
