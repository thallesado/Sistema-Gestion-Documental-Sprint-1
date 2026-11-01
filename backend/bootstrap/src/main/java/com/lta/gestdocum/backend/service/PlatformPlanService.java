package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.billing.SubscriptionItems;
import com.lta.gestdocum.backend.dto.PlatformPlanDtos.*;
import com.lta.gestdocum.backend.exception.ConfirmationRequiredException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Catálogo de planes editable por el administrador global (fase 2): datos, límites, funcionalidades y
 * precios versionados. Stripe es la fuente de verdad del cobro: un precio nuevo se crea primero en
 * Stripe y solo si eso funciona se guarda la versión. Las suscripciones existentes conservan su precio
 * salvo migración explícita, que se programa con un Subscription Schedule y al menos 30 días de aviso.
 * Cada cambio exige motivo y queda en la auditoría de plataforma.
 */
@Service
public class PlatformPlanService {
    private static final Logger log = LoggerFactory.getLogger(PlatformPlanService.class);
    static final List<String> LIMIT_KEYS = List.of(PlanLimitService.MAX_USERS, PlanLimitService.MAX_STORAGE_MB,
            PlanLimitService.MAX_DOCUMENTS, PlanLimitService.MAX_OCR_PAGES);
    static final long NOTICE_DAYS = 30;
    private static final String LIVE_STATUSES = "('TRIAL','ACTIVE','PAST_DUE','SUSPENDED')";

    private final JdbcTemplate jdbc;
    private final PlatformAuditService audit;
    private final PlanEnforcementService planEnforcement;
    private final StripeApiClient stripe;
    private final StripeBillingProperties properties;
    private final TransactionTemplate transaction;
    private final JavaMailSender mailSender;
    private final String mailFrom;

    public PlatformPlanService(JdbcTemplate jdbc, PlatformAuditService audit, PlanEnforcementService planEnforcement,
                               StripeApiClient stripe, StripeBillingProperties properties,
                               PlatformTransactionManager transactionManager,
                               ObjectProvider<JavaMailSender> mailSenderProvider,
                               @Value("${app.mail-from:no-reply@nexodocs.local}") String mailFrom) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.planEnforcement = planEnforcement;
        this.stripe = stripe;
        this.properties = properties;
        this.transaction = new TransactionTemplate(transactionManager);
        this.mailSender = mailSenderProvider == null ? null : mailSenderProvider.getIfAvailable();
        this.mailFrom = mailFrom;
    }

    // ------------------------------------------------------------------ consulta

    @Transactional(readOnly = true)
    public List<PlanView> list() {
        audit.requirePlatformAccount();
        return jdbc.queryForList("select id from plans order by sort_order, code").stream()
                .map(row -> view((UUID) row.get("id"))).toList();
    }

    PlanView view(UUID planId) {
        Map<String, Object> plan = plan(planId);
        Map<String, Long> limits = new LinkedHashMap<>();
        LIMIT_KEYS.forEach(key -> limits.put(key, -1L));
        jdbc.queryForList("select resource_key, resource_value from plan_limits where plan_id = ?", planId)
                .forEach(r -> limits.put((String) r.get("resource_key"), ((Number) r.get("resource_value")).longValue()));
        List<FeatureView> features = jdbc.queryForList(
                "select feature_key, is_enabled, description from plan_features where plan_id = ? order by feature_key", planId)
                .stream().map(r -> new FeatureView((String) r.get("feature_key"), Boolean.TRUE.equals(r.get("is_enabled")),
                        (String) r.get("description"))).toList();
        List<PriceView> prices = jdbc.queryForList("""
                select pp.id, pp.billing_cycle, pp.amount_usd, pp.stripe_price_id, pp.effective_from, pp.archived_at,
                  (select count(*) from tenants t where t.purged_at is null and t.subscription_status in %1$s
                     and (t.plan_price_id = pp.id or (pp.archived_at is null and t.plan_price_id is null
                       and t.plan_id = pp.plan_id and coalesce(t.billing_cycle_v2, 'MONTHLY') = pp.billing_cycle))) as tenants,
                  (select count(*) from tenants t where t.price_change_price_id = pp.id) as pending
                from plan_prices pp where pp.plan_id = ?
                order by pp.billing_cycle, pp.effective_from desc
                """.formatted(LIVE_STATUSES), planId).stream()
                .map(r -> new PriceView((UUID) r.get("id"), (String) r.get("billing_cycle"), (BigDecimal) r.get("amount_usd"),
                        (String) r.get("stripe_price_id"), PlatformTenantService.instant(r.get("effective_from")),
                        PlatformTenantService.instant(r.get("archived_at")), number(r.get("tenants")), number(r.get("pending"))))
                .toList();
        return new PlanView(planId, (String) plan.get("code"), (String) plan.get("name"), (String) plan.get("description"),
                Boolean.TRUE.equals(plan.get("is_active")), ((Number) plan.get("sort_order")).intValue(),
                tenantsOnPlan(planId), limits, features, prices);
    }

    // ------------------------------------------------------------- datos del plan

    /** Desactivar retira el plan de la venta (catálogo, checkout, alta); quien ya lo tiene lo conserva. */
    @Transactional
    public PlanView updatePlan(UUID planId, PlanUpdate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        Map<String, Object> before = lockPlan(planId);
        if (!request.active() && Boolean.TRUE.equals(before.get("is_active"))
                && "BASIC".equalsIgnoreCase((String) before.get("code"))) {
            // Las altas sin plan explícito y la recuperación de límites usan BASIC por defecto.
            throw new IllegalStateException("El plan BASIC es el plan por defecto y no se puede retirar de la venta");
        }
        jdbc.update("update plans set name = ?, description = ?, is_active = ?, sort_order = ?, updated_at = now() where id = ?",
                request.name().trim(), blankToNull(request.description()), request.active(), request.sortOrder(), planId);
        audit.record("PLAN_UPDATED", null, reason,
                mapOf("plan", before.get("code"), "name", before.get("name"), "active", before.get("is_active"),
                        "sortOrder", before.get("sort_order")),
                mapOf("plan", before.get("code"), "name", request.name().trim(), "active", request.active(),
                        "sortOrder", request.sortOrder()));
        return view(planId);
    }

    /**
     * Bajar un límite no bloquea a quien ya lo supera: PlanLimitService solo impide crecer (igual que al
     * bajar de plan). Si hay organizaciones por encima se pide confirmación antes de aplicarlo.
     */
    @Transactional
    public PlanView updateLimits(UUID planId, LimitsUpdate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        Map<String, Object> plan = lockPlan(planId);
        Map<String, Long> current = view(planId).limits();
        Map<String, Long> changes = new LinkedHashMap<>();
        request.limits().forEach((key, value) -> {
            if (!LIMIT_KEYS.contains(key)) throw new IllegalArgumentException("Límite desconocido: " + key);
            if (value == null || value < -1) throw new IllegalArgumentException("El límite " + key + " debe ser -1 (ilimitado) o mayor o igual a 0");
            if (!value.equals(current.get(key))) changes.put(key, value);
        });
        if (changes.isEmpty()) throw new IllegalArgumentException("No hay cambios en los límites");

        List<String> over = new ArrayList<>();
        changes.forEach((key, value) -> {
            if (value != -1 && (current.get(key) == -1 || value < current.get(key))) over.addAll(tenantsOverLimit(planId, key, value));
        });
        List<String> affected = over.stream().distinct().toList();
        if (!affected.isEmpty() && !request.acceptImpact()) {
            throw new ConfirmationRequiredException(affected.size() + " organización(es) del plan " + plan.get("name")
                    + " ya superan el límite nuevo. Seguirán operando, pero no podrán crecer en ese recurso.",
                    affected.size(), affected.subList(0, Math.min(20, affected.size())));
        }
        changes.forEach((key, value) -> jdbc.update("""
                insert into plan_limits (plan_id, resource_key, resource_value, unit) values (?, ?, ?, ?)
                on conflict (plan_id, resource_key) do update set resource_value = excluded.resource_value
                """, planId, key, value, unit(key)));
        jdbc.update("update plans set updated_at = now() where id = ?", planId);
        Map<String, Object> before = new LinkedHashMap<>();
        changes.keySet().forEach(key -> before.put(key, current.get(key)));
        Map<String, Object> after = new LinkedHashMap<>(changes);
        after.put("plan", plan.get("code"));
        if (!affected.isEmpty()) after.put("tenantsOverLimit", affected.size());
        before.put("plan", plan.get("code"));
        audit.record("PLAN_LIMITS_UPDATED", null, reason, before, after);
        return view(planId);
    }

    /**
     * Retirar una funcionalidad la quita a todas las organizaciones del plan: app.has_permission (048)
     * deja de concederla en la base de inmediato y el JWT la pierde al renovar sesión. Activarla concede
     * los permisos nuevos al grupo administrador de cada organización del plan.
     */
    @Transactional
    public PlanView updateFeatures(UUID planId, FeaturesUpdate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        Map<String, Object> plan = lockPlan(planId);
        Map<String, Boolean> current = new LinkedHashMap<>();
        view(planId).features().forEach(f -> current.put(f.key(), f.enabled()));
        Map<String, Boolean> changes = new LinkedHashMap<>();
        request.features().forEach((key, enabled) -> {
            // El catálogo de funcionalidades es fijo: cada una corresponde a comprobaciones del backend.
            if (!current.containsKey(key)) throw new IllegalArgumentException("Funcionalidad desconocida: " + key);
            if (enabled == null) throw new IllegalArgumentException("Valor inválido para " + key);
            if (!enabled.equals(current.get(key))) changes.put(key, enabled);
        });
        if (changes.isEmpty()) throw new IllegalArgumentException("No hay cambios en las funcionalidades");

        boolean removes = changes.containsValue(false);
        long affected = removes ? tenantsOnPlan(planId) : 0;
        if (affected > 0 && !request.acceptImpact()) {
            throw new ConfirmationRequiredException(affected + " organización(es) del plan " + plan.get("name")
                    + " perderán " + String.join(", ", changes.entrySet().stream().filter(e -> !e.getValue()).map(Map.Entry::getKey).toList())
                    + ". Sus usuarios dejarán de tenerla al renovar sesión.", affected, tenantNamesOnPlan(planId));
        }
        changes.forEach((key, enabled) ->
                jdbc.update("update plan_features set is_enabled = ? where plan_id = ? and feature_key = ?", enabled, planId, key));
        jdbc.update("update plans set updated_at = now() where id = ?", planId);
        if (changes.containsValue(true)) {
            for (UUID tenantId : jdbc.queryForList("select id from tenants where plan_id = ? and purged_at is null", UUID.class, planId)) {
                planEnforcement.grantNewPlanPermissionsToAdminRole(tenantId, planId);
            }
        }
        Map<String, Object> before = new LinkedHashMap<>();
        changes.keySet().forEach(key -> before.put(key, current.get(key)));
        before.put("plan", plan.get("code"));
        Map<String, Object> after = new LinkedHashMap<>(changes);
        after.put("plan", plan.get("code"));
        if (affected > 0) after.put("tenantsAffected", affected);
        audit.record("PLAN_FEATURES_UPDATED", null, reason, before, after);
        return view(planId);
    }

    // ---------------------------------------------------------------- precios

    /**
     * Nueva versión de precio. Orden: Price en Stripe → versión en la base (transacción) → archivo del
     * Price anterior en Stripe. Si Stripe falla no se guarda nada; si la base falla se archiva el Price
     * recién creado. Las suscripciones existentes siguen con su precio (grandfathering).
     */
    public PlanView createPriceVersion(UUID planId, PriceCreate request) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(request.reason());
        String cycle = request.billingCycle();
        BigDecimal amount = request.amountUsd().setScale(2, RoundingMode.HALF_UP);
        Map<String, Object> plan = plan(planId);
        String code = (String) plan.get("code");
        Map<String, Object> current = currentPrice(planId, cycle);
        if (current != null && amount.compareTo((BigDecimal) current.get("amount_usd")) == 0) {
            throw new IllegalArgumentException("El precio nuevo es igual al vigente");
        }
        String previousStripe = current == null ? null : (String) current.get("stripe_price_id");
        if (previousStripe == null) previousStripe = properties.environmentPriceFor(code, cycle).orElse(null);

        String newStripe = null;
        if (properties.configured()) {
            String product = previousStripe != null
                    ? stripe.retrievePrice(previousStripe).path("product").asText()
                    : stripe.createProduct(Map.of("name", "NexoDocs " + plan.get("name"), "metadata[planCode]", code),
                            "nexodocs-product-" + code).path("id").asText();
            Map<String, String> form = new LinkedHashMap<>();
            form.put("product", product);
            form.put("currency", "usd");
            form.put("unit_amount", amount.movePointRight(2).toBigInteger().toString());
            form.put("recurring[interval]", "ANNUAL".equals(cycle) ? "year" : "month");
            form.put("nickname", plan.get("name") + " " + ("ANNUAL".equals(cycle) ? "anual" : "mensual") + " " + amount);
            form.put("metadata[planCode]", code);
            form.put("metadata[billingCycle]", cycle);
            newStripe = stripe.createPrice(form, "nexodocs-price-" + planId + "-" + cycle + "-" + amount.toPlainString()
                    + "-" + (current == null ? "first" : current.get("id"))).path("id").asText();
        }

        String createdStripe = newStripe;
        String backfill = previousStripe;
        UUID actor = audit.requirePlatformAccount().userId();
        try {
            transaction.executeWithoutResult(status -> {
                Map<String, Object> locked = currentPriceForUpdate(planId, cycle);
                if (!Objects.equals(locked == null ? null : locked.get("id"), current == null ? null : current.get("id"))) {
                    throw new IllegalStateException("El precio cambió mientras se creaba la versión nueva; vuelve a intentarlo");
                }
                if (locked != null) {
                    // La versión inicial (063) no tenía id de Stripe: se registra el que estaba en las variables.
                    if (locked.get("stripe_price_id") == null && backfill != null) {
                        jdbc.update("update plan_prices set stripe_price_id = ? where id = ?", backfill, locked.get("id"));
                    }
                    jdbc.update("update plan_prices set archived_at = now() where id = ?", locked.get("id"));
                }
                jdbc.update("""
                        insert into plan_prices (plan_id, billing_cycle, amount_usd, stripe_price_id, created_by)
                        values (?, ?, ?, ?, ?)
                        """, planId, cycle, amount, createdStripe, actor);
                jdbc.update("update plans set " + ("ANNUAL".equals(cycle) ? "price_yearly" : "price_monthly")
                        + " = ?, updated_at = now() where id = ?", amount, planId);
                audit.record("PLAN_PRICE_CHANGED", null, reason,
                        mapOf("plan", code, "billingCycle", cycle, "amountUsd", current == null ? null : current.get("amount_usd"),
                                "stripePriceId", backfill),
                        mapOf("plan", code, "billingCycle", cycle, "amountUsd", amount, "stripePriceId", createdStripe));
            });
        } catch (RuntimeException exception) {
            if (createdStripe != null) archiveStripePrice(createdStripe);
            throw exception;
        }
        if (backfill != null && properties.configured()) archiveStripePrice(backfill);
        return transaction.execute(status -> view(planId));
    }

    /**
     * Migra a la versión vigente a quienes pagan una anterior del mismo plan y ciclo. El cambio se
     * programa en Stripe para la primera renovación con al menos 30 días de aviso; se avisa por correo y
     * notificación y queda en la auditoría del tenant y en la de plataforma.
     */
    public MigrationResult migrateSubscribers(UUID priceId, String reasonText) {
        audit.requirePlatformAccount();
        String reason = PlatformAuditService.requireReason(reasonText);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select pp.id, pp.plan_id, pp.billing_cycle, pp.amount_usd, pp.stripe_price_id, pp.archived_at, p.name as plan_name
                from plan_prices pp join plans p on p.id = pp.plan_id where pp.id = ?
                """, priceId);
        if (rows.isEmpty()) throw new NotFoundException("Versión de precio no encontrada");
        Map<String, Object> target = rows.get(0);
        if (target.get("archived_at") != null) throw new IllegalStateException("Solo se migra a la versión vigente");
        if (target.get("stripe_price_id") == null || !properties.configured()) {
            throw new IllegalStateException("La versión vigente no existe en Stripe: no hay suscripciones que migrar");
        }
        String newStripe = (String) target.get("stripe_price_id");
        String cycle = (String) target.get("billing_cycle");
        List<Map<String, Object>> candidates = jdbc.queryForList("""
                select t.id, t.name, t.email, t.stripe_subscription_id, t.stripe_schedule_id, t.scheduled_plan_id,
                  t.cancel_at_period_end, t.price_change_price_id, t.plan_price_id
                from tenants t
                where t.plan_id = ? and coalesce(t.billing_cycle_v2, 'MONTHLY') = ? and t.stripe_subscription_id is not null
                  and t.purged_at is null and t.subscription_status in ('ACTIVE','PAST_DUE','TRIAL')
                  and t.plan_price_id is distinct from ?
                order by t.name
                """, target.get("plan_id"), cycle, priceId);
        int scheduled = 0;
        List<MigrationSkip> skipped = new ArrayList<>();
        for (Map<String, Object> tenant : candidates) {
            UUID tenantId = (UUID) tenant.get("id");
            String name = (String) tenant.get("name");
            String skip = skipReason(tenant, priceId);
            if (skip != null) { skipped.add(new MigrationSkip(tenantId, name, skip)); continue; }
            try {
                Instant effectiveAt = scheduleMigration((String) tenant.get("stripe_subscription_id"), newStripe, cycle, tenantId, priceId);
                if (effectiveAt == null) {
                    skipped.add(new MigrationSkip(tenantId, name, "Ya paga el precio vigente"));
                    continue;
                }
                String amount = target.get("amount_usd") + " USD";
                transaction.executeWithoutResult(status -> {
                    recordTenantNotice(tenantId, amount, effectiveAt);
                    audit.record("PLAN_PRICE_MIGRATION_SCHEDULED", tenantId, reason,
                            mapOf("planPriceId", str(tenant.get("plan_price_id"))),
                            mapOf("planPriceId", priceId.toString(), "amountUsd", target.get("amount_usd"), "effectiveAt", effectiveAt.toString()));
                });
                notifyByEmail((String) tenant.get("email"), name, (String) target.get("plan_name"), amount, effectiveAt);
                scheduled++;
            } catch (RuntimeException exception) {
                log.warn("No se pudo programar la migración de precio de {}: {}", tenantId, exception.getMessage());
                skipped.add(new MigrationSkip(tenantId, name, "Error de Stripe: no se programó"));
            }
        }
        return new MigrationResult(scheduled, skipped);
    }

    static String skipReason(Map<String, Object> tenant, UUID priceId) {
        if (priceId.equals(tenant.get("price_change_price_id"))) return "La migración ya está programada";
        if (Boolean.TRUE.equals(tenant.get("cancel_at_period_end"))) return "No renovará la suscripción";
        if (tenant.get("scheduled_plan_id") != null || tenant.get("stripe_schedule_id") != null) {
            return "Tiene un cambio de plan programado";
        }
        return null;
    }

    /** Fases: período actual con el precio actual, una renovación más si faltan menos de 30 días, y luego el precio nuevo. */
    private Instant scheduleMigration(String subscriptionId, String newPrice, String cycle, UUID tenantId, UUID priceId) {
        JsonNode subscription = stripe.retrieveSubscription(subscriptionId);
        JsonNode item = SubscriptionItems.planItem(subscription);
        String currentPrice = SubscriptionItems.priceId(item);
        List<JsonNode> addonItems = SubscriptionItems.addonItems(subscription);
        if (newPrice.equals(currentPrice)) {
            jdbc.update("update tenants set plan_price_id = ? where id = ?", priceId, tenantId);
            return null;
        }
        JsonNode schedule = stripe.createScheduleFromSubscription(subscriptionId);
        JsonNode phase = schedule.path("phases").path(0);
        long start = phase.path("start_date").asLong();
        long end = phase.path("end_date").asLong();
        String quantity = String.valueOf(item.path("quantity").asLong(1));
        String interval = "ANNUAL".equals(cycle) ? "year" : "month";
        Map<String, String> form = new LinkedHashMap<>();
        form.put("end_behavior", "release");
        form.put("phases[0][items][0][price]", currentPrice);
        form.put("phases[0][items][0][quantity]", quantity);
        SubscriptionItems.putAddonItems(form, 0, 1, addonItems);
        form.put("phases[0][start_date]", String.valueOf(start));
        form.put("phases[0][end_date]", String.valueOf(end));
        Instant effectiveAt = Instant.ofEpochSecond(end);
        int next = 1;
        if (effectiveAt.isBefore(Instant.now().plus(NOTICE_DAYS, ChronoUnit.DAYS))) {
            form.put("phases[1][items][0][price]", currentPrice);
            form.put("phases[1][items][0][quantity]", quantity);
            SubscriptionItems.putAddonItems(form, 1, 1, addonItems);
            form.put("phases[1][duration][interval]", interval);
            form.put("phases[1][duration][interval_count]", "1");
            effectiveAt = plusCycle(effectiveAt, cycle);
            next = 2;
        }
        form.put("phases[" + next + "][items][0][price]", newPrice);
        form.put("phases[" + next + "][items][0][quantity]", quantity);
        SubscriptionItems.putAddonItems(form, next, 1, addonItems);
        form.put("phases[" + next + "][duration][interval]", interval);
        form.put("phases[" + next + "][duration][interval_count]", "1");
        form.put("phases[" + next + "][proration_behavior]", "none");
        String scheduleId = stripe.updateSchedule(schedule.path("id").asText(), form).path("id").asText();
        jdbc.update("update tenants set stripe_schedule_id = ?, price_change_price_id = ?, price_change_at = ? where id = ?",
                scheduleId, priceId, Timestamp.from(effectiveAt), tenantId);
        return effectiveAt;
    }

    static Instant plusCycle(Instant from, String cycle) {
        var date = from.atZone(ZoneOffset.UTC);
        return ("ANNUAL".equals(cycle) ? date.plusYears(1) : date.plusMonths(1)).toInstant();
    }

    /** Aviso visible para la organización: su auditoría y una notificación a sus administradores. */
    private void recordTenantNotice(UUID tenantId, String amount, Instant effectiveAt) {
        UUID actor = audit.requirePlatformAccount().userId();
        jdbc.update("""
                insert into audit_events (tenant_id, platform_actor_id, action, entity_type, entity_id, result, details)
                values (?, ?, 'SUBSCRIPTION_PRICE_CHANGE_SCHEDULED', 'tenants', ?, 'SUCCESS',
                  jsonb_build_object('amount', ?::text, 'effectiveAt', ?::text))
                """, tenantId, actor, tenantId, amount, effectiveAt.toString());
        String date = effectiveAt.toString().substring(0, 10);
        jdbc.update("""
                insert into notifications (tenant_id, user_id, type, title, message, related_entity_type, related_entity_id)
                select distinct u.tenant_id, u.id, 'SUBSCRIPTION_PRICE_CHANGE', 'Cambio de precio de tu suscripción', ?, 'tenants', u.tenant_id
                from users u
                join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
                join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
                where u.tenant_id = ? and u.deleted_at is null and u.status = 'ACTIVE' and r.name = 'Administrador de tenant'
                """, "Desde el " + date + " tu plan se renovará a " + amount + ". Hasta entonces se mantiene tu precio actual.", tenantId);
    }

    private void notifyByEmail(String to, String tenant, String plan, String amount, Instant effectiveAt) {
        if (mailSender == null || to == null || to.isBlank()) return;
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(to);
            message.setSubject("NexoDocs - Cambio de precio de tu suscripción");
            message.setText("Hola,\n\nEl precio del plan " + plan + " de " + tenant + " cambiará a " + amount
                    + " a partir de la renovación del " + effectiveAt.toString().substring(0, 10)
                    + ". Hasta esa fecha se mantiene tu precio actual.\n\n"
                    + "Puedes revisar o cancelar tu suscripción en Facturación → Gestionar suscripción.\n\n"
                    + "Atentamente,\nEl equipo de NexoDocs");
            mailSender.send(message);
        } catch (RuntimeException exception) {
            log.warn("No se pudo enviar el aviso de precio a {}: {}", to, exception.getMessage());
        }
    }

    private void archiveStripePrice(String priceId) {
        try {
            stripe.updatePrice(priceId, Map.of("active", "false"));
        } catch (RuntimeException exception) {
            // Un Price activo de más no cobra a nadie; queda en el registro para archivarlo a mano.
            log.warn("No se pudo archivar el precio {} en Stripe: {}", priceId, exception.getMessage());
        }
    }

    // --------------------------------------------------------------- utilidades

    private List<String> tenantsOverLimit(UUID planId, String key, long value) {
        String usage = switch (key) {
            case PlanLimitService.MAX_USERS ->
                    "(select count(*) from users u where u.tenant_id = t.id and u.status = 'ACTIVE' and u.deleted_at is null)";
            case PlanLimitService.MAX_DOCUMENTS ->
                    "(select count(*) from documents d where d.tenant_id = t.id and d.deleted_at is null)";
            case PlanLimitService.MAX_STORAGE_MB ->
                    "(select coalesce(sum(v.file_size_bytes), 0) / (1024 * 1024) from document_versions v where v.tenant_id = t.id)";
            case PlanLimitService.MAX_OCR_PAGES ->
                    "(select coalesce(max(m.ocr_pages), 0) from tenant_usage_monthly m where m.tenant_id = t.id"
                            + " and m.year_month = date_trunc('month', now())::date)";
            default -> throw new IllegalArgumentException("Límite desconocido: " + key);
        };
        return jdbc.queryForList("select t.name from tenants t where t.plan_id = ? and t.purged_at is null"
                + " and t.subscription_status in " + LIVE_STATUSES + " and " + usage + " > ? order by t.name", String.class, planId, value);
    }

    private long tenantsOnPlan(UUID planId) {
        Long count = jdbc.queryForObject("select count(*) from tenants where plan_id = ? and purged_at is null and subscription_status in "
                + LIVE_STATUSES, Long.class, planId);
        return count == null ? 0 : count;
    }

    private List<String> tenantNamesOnPlan(UUID planId) {
        return jdbc.queryForList("select name from tenants where plan_id = ? and purged_at is null and subscription_status in "
                + LIVE_STATUSES + " order by name limit 20", String.class, planId);
    }

    private Map<String, Object> plan(UUID planId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select id, code, name, description, is_active, sort_order from plans where id = ?", planId);
        if (rows.isEmpty()) throw new NotFoundException("Plan no encontrado");
        return rows.get(0);
    }

    private Map<String, Object> lockPlan(UUID planId) {
        jdbc.queryForList("select id from plans where id = ? for update", planId);
        return plan(planId);
    }

    private Map<String, Object> currentPrice(UUID planId, String cycle) {
        return jdbc.queryForList("""
                select id, amount_usd, stripe_price_id from plan_prices
                where plan_id = ? and billing_cycle = ? and archived_at is null
                """, planId, cycle).stream().findFirst().orElse(null);
    }

    private Map<String, Object> currentPriceForUpdate(UUID planId, String cycle) {
        return jdbc.queryForList("""
                select id, amount_usd, stripe_price_id from plan_prices
                where plan_id = ? and billing_cycle = ? and archived_at is null for update
                """, planId, cycle).stream().findFirst().orElse(null);
    }

    private static String unit(String key) {
        return switch (key) {
            case PlanLimitService.MAX_USERS -> "users";
            case PlanLimitService.MAX_STORAGE_MB -> "MB";
            case PlanLimitService.MAX_DOCUMENTS -> "documents";
            default -> "pages/month";
        };
    }

    private static Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private static String str(Object value) { return value == null ? null : value.toString(); }

    private static long number(Object value) { return value == null ? 0 : ((Number) value).longValue(); }
}
