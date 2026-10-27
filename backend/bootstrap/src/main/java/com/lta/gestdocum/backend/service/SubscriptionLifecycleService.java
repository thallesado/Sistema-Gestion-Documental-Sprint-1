package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.billing.SubscriptionItems;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionCancelRequest;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionDetailsResponse;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionPlanRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Stream;

/**
 * Ciclo de vida de la suscripción del tenant: mejorar plan al instante, programar un cambio para el
 * próximo período, no renovar, reanudar y cancelar con borrado diferido de la organización.
 *
 * <p>Con Stripe, Stripe es la fuente de verdad: se llama a su API y el resultado se refleja con
 * {@link StripeSubscriptionService#syncTenant}; los webhooks confirman lo mismo después. Sin Stripe
 * (pago manual por QR o USDT, o prueba) el estado vive en {@code tenants} y lo aplica el job periódico.
 *
 * <p>Las escrituras sobre {@code tenants} usan el usuario de conexión, sin contexto RLS, igual que el
 * webhook de Stripe: {@code nexodocs_app} no tiene privilegios sobre las columnas de facturación.
 */
@Service
public class SubscriptionLifecycleService {
    private static final Logger log = LoggerFactory.getLogger(SubscriptionLifecycleService.class);
    private static final Set<String> CANCELABLE = Set.of("TRIAL", "ACTIVE", "PAST_DUE");

    private final JdbcTemplate jdbc;
    private final AuthenticatedUserContext context;
    private final StripeSubscriptionService stripeSubscriptions;
    private final StripeApiClient stripe;
    private final StripeBillingProperties properties;
    private final PlanEnforcementService planEnforcement;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transaction;
    private final Path storageRoot;
    private final int retentionDays;

    public SubscriptionLifecycleService(JdbcTemplate jdbc, AuthenticatedUserContext context,
                                        StripeSubscriptionService stripeSubscriptions, StripeApiClient stripe,
                                        StripeBillingProperties properties, PlanEnforcementService planEnforcement,
                                        UserRepository users, PasswordEncoder passwordEncoder, ObjectMapper objectMapper,
                                        PlatformTransactionManager transactionManager,
                                        @Value("${app.storage.local-path:./data/storage}") String storagePath,
                                        @Value("${billing.cancellation.retention-days:30}") int retentionDays) {
        this.jdbc = jdbc; this.context = context; this.stripeSubscriptions = stripeSubscriptions; this.stripe = stripe;
        this.properties = properties; this.planEnforcement = planEnforcement; this.users = users;
        this.passwordEncoder = passwordEncoder; this.objectMapper = objectMapper;
        this.transaction = new TransactionTemplate(transactionManager);
        this.storageRoot = Path.of(storagePath).toAbsolutePath().normalize();
        this.retentionDays = retentionDays;
    }

    // ------------------------------------------------------------------ consulta

    public SubscriptionDetailsResponse details() {
        UUID tenantId = context.requireTenantId();
        Map<String, Object> row = tenantRow(tenantId);
        return new SubscriptionDetailsResponse(
                (String) row.get("name"), (String) row.get("subscription_status"),
                (String) row.get("plan_code"), (String) row.get("plan_name"),
                (BigDecimal) row.get("price_monthly"), (BigDecimal) row.get("price_yearly"),
                Objects.toString(row.get("billing_cycle_v2"), "MONTHLY"), (String) row.get("preferred_payment_method"),
                instant(row.get("current_period_end")), instant(row.get("trial_ends_at")),
                row.get("stripe_subscription_id") != null, !Boolean.TRUE.equals(row.get("cancel_at_period_end")),
                (String) row.get("scheduled_plan_code"), (String) row.get("scheduled_billing_cycle"),
                instant(row.get("scheduled_change_at")), instant(row.get("canceled_at")),
                instant(row.get("deletion_scheduled_at")), retentionDays);
    }

    // ------------------------------------------------------------- cambio de plan

    /** Sube de plan ya, cobrando la diferencia prorrateada. Solo con suscripción de Stripe. */
    public SubscriptionDetailsResponse upgradeNow(SubscriptionPlanRequest request) {
        UUID tenantId = context.requireTenantId();
        Map<String, Object> tenant = requireOperable(tenantId);
        String subscriptionId = (String) tenant.get("stripe_subscription_id");
        if (subscriptionId == null) {
            // Sin suscripción recurrente el pago se hace por Checkout (o QR/USDT) desde Facturación.
            throw new IllegalStateException("La organización no tiene una suscripción con tarjeta: usa «Pagar y activar» para cambiar de plan");
        }
        Map<String, Object> target = requirePlan(request.planCode());
        String cycle = cycleOrCurrent(request.billingCycle(), tenant);
        // Se compara el equivalente mensual: pasar a anual el mismo plan cuesta menos por mes y se programa.
        String currentCycle = Objects.toString(tenant.get("billing_cycle_v2"), "MONTHLY");
        if (monthly(price(target, cycle), cycle).compareTo(monthly(currentPrice(tenant, currentCycle), currentCycle)) <= 0) {
            throw new IllegalArgumentException("Para bajar de plan o cambiar de ciclo prográmalo para el próximo período");
        }
        String price = requireStripePrice((String) target.get("code"), cycle);
        JsonNode subscription = stripe.retrieveSubscription(subscriptionId);
        requireSameCycleForAddons(subscription, cycle, currentCycle);
        releaseScheduleIfAny(tenant);
        String itemId = SubscriptionItems.planItem(subscription).path("id").asText();
        Map<String, String> form = new LinkedHashMap<>();
        form.put("items[0][id]", itemId);
        form.put("items[0][price]", price);
        // Cobra la diferencia ahora; si la tarjeta falla, Stripe rechaza el cambio y el plan no varía.
        form.put("proration_behavior", "always_invoice");
        form.put("payment_behavior", "error_if_incomplete");
        JsonNode updated = stripe.updateSubscription(subscriptionId, form);
        stripeSubscriptions.syncTenant(updated);
        jdbc.update("update tenants set scheduled_plan_id = null, scheduled_billing_cycle = null, scheduled_change_at = null, stripe_schedule_id = null where id = ?", tenantId);
        grantPlanPermissions(tenantId, (UUID) target.get("id"));
        audit(tenantId, "SUBSCRIPTION_UPGRADED", Map.of("plan", target.get("code"), "billingCycle", cycle));
        return details();
    }

    /** El plan nuevo empieza al terminar el período pagado; la próxima factura ya lo cobra. */
    public SubscriptionDetailsResponse scheduleChange(SubscriptionPlanRequest request) {
        UUID tenantId = context.requireTenantId();
        Map<String, Object> tenant = requireOperable(tenantId);
        if (Boolean.TRUE.equals(tenant.get("cancel_at_period_end"))) {
            throw new IllegalStateException("La suscripción no se renovará: reanuda la renovación antes de programar un cambio de plan");
        }
        Map<String, Object> target = requirePlan(request.planCode());
        String cycle = cycleOrCurrent(request.billingCycle(), tenant);
        if (target.get("id").equals(tenant.get("plan_id")) && sameCycle(cycle, tenant)) {
            throw new IllegalArgumentException("Ese ya es tu plan actual");
        }
        UUID targetId = (UUID) target.get("id");
        // Una bajada que no admite el uso actual se rechaza ahora, no al llegar la fecha.
        transaction.executeWithoutResult(status -> {
            context.establishDatabaseContext();
            planEnforcement.assertCurrentUsageFits(tenantId, targetId);
        });

        Instant effectiveAt;
        String scheduleId = null;
        String subscriptionId = (String) tenant.get("stripe_subscription_id");
        if (subscriptionId != null) {
            String newPrice = requireStripePrice((String) target.get("code"), cycle);
            JsonNode subscription = stripe.retrieveSubscription(subscriptionId);
            requireSameCycleForAddons(subscription, cycle, Objects.toString(tenant.get("billing_cycle_v2"), "MONTHLY"));
            releaseScheduleIfAny(tenant);
            JsonNode schedule = stripe.createScheduleFromSubscription(subscriptionId);
            JsonNode current = schedule.path("phases").path(0);
            JsonNode currentItem = SubscriptionItems.planItem(subscription);
            String currentPrice = SubscriptionItems.priceId(currentItem);
            List<JsonNode> addonItems = SubscriptionItems.addonItems(subscription);
            Map<String, String> form = new LinkedHashMap<>();
            form.put("end_behavior", "release");
            form.put("phases[0][items][0][price]", currentPrice);
            form.put("phases[0][items][0][quantity]", String.valueOf(currentItem.path("quantity").asLong(1)));
            SubscriptionItems.putAddonItems(form, 0, 1, addonItems);
            form.put("phases[0][start_date]", String.valueOf(current.path("start_date").asLong()));
            form.put("phases[0][end_date]", String.valueOf(current.path("end_date").asLong()));
            form.put("phases[1][items][0][price]", newPrice);
            form.put("phases[1][items][0][quantity]", "1");
            // Los complementos siguen en las facturas del plan nuevo (mismo ciclo, comprobado arriba).
            SubscriptionItems.putAddonItems(form, 1, 1, addonItems);
            form.put("phases[1][duration][interval]", "ANNUAL".equals(cycle) ? "year" : "month");
            form.put("phases[1][duration][interval_count]", "1");
            form.put("phases[1][proration_behavior]", "none");
            JsonNode updated = stripe.updateSchedule(schedule.path("id").asText(), form);
            scheduleId = updated.path("id").asText();
            effectiveAt = Instant.ofEpochSecond(current.path("end_date").asLong());
        } else {
            effectiveAt = periodEnd(tenant);
        }
        jdbc.update("""
                update tenants set scheduled_plan_id = ?, scheduled_billing_cycle = ?, scheduled_change_at = ?,
                  stripe_schedule_id = ? where id = ?
                """, targetId, cycle, Timestamp.from(effectiveAt), scheduleId, tenantId);
        audit(tenantId, "SUBSCRIPTION_CHANGE_SCHEDULED", Map.of("plan", target.get("code"), "billingCycle", cycle,
                "effectiveAt", effectiveAt.toString()));
        return details();
    }

    public SubscriptionDetailsResponse cancelScheduledChange() {
        UUID tenantId = context.requireTenantId();
        Map<String, Object> tenant = requireOperable(tenantId);
        if (tenant.get("scheduled_plan_id") == null) throw new IllegalArgumentException("No hay un cambio de plan programado");
        releaseScheduleIfAny(tenant);
        jdbc.update("update tenants set scheduled_plan_id = null, scheduled_billing_cycle = null, scheduled_change_at = null, stripe_schedule_id = null where id = ?", tenantId);
        audit(tenantId, "SUBSCRIPTION_CHANGE_UNSCHEDULED", Map.of());
        return details();
    }

    // -------------------------------------------------------------- renovación

    /** false = no renovar: se conserva el acceso hasta el fin del período pagado y luego se cancela. */
    public SubscriptionDetailsResponse setAutoRenew(boolean autoRenew) {
        UUID tenantId = context.requireTenantId();
        Map<String, Object> tenant = requireOperable(tenantId);
        String subscriptionId = (String) tenant.get("stripe_subscription_id");
        if (!autoRenew) releaseScheduleIfAny(tenant); // sin renovación no hay cambio de plan futuro
        if (subscriptionId != null) {
            JsonNode updated = stripe.updateSubscription(subscriptionId,
                    Map.of("cancel_at_period_end", String.valueOf(!autoRenew)));
            stripeSubscriptions.syncTenant(updated);
        } else if (!autoRenew && tenant.get("current_period_end") == null) {
            jdbc.update("update tenants set current_period_end = ? where id = ?", Timestamp.from(periodEnd(tenant)), tenantId);
        }
        jdbc.update("""
                update tenants set cancel_at_period_end = ?,
                  scheduled_plan_id = case when ? then scheduled_plan_id end,
                  scheduled_billing_cycle = case when ? then scheduled_billing_cycle end,
                  scheduled_change_at = case when ? then scheduled_change_at end,
                  stripe_schedule_id = case when ? then stripe_schedule_id end
                where id = ?
                """, !autoRenew, autoRenew, autoRenew, autoRenew, autoRenew, tenantId);
        audit(tenantId, autoRenew ? "SUBSCRIPTION_RENEWAL_RESUMED" : "SUBSCRIPTION_RENEWAL_STOPPED", Map.of());
        return details();
    }

    // -------------------------------------------------------------- cancelación

    /**
     * Cancela ya la suscripción y programa el borrado de la organización al terminar el período de
     * gracia. Exige el nombre exacto de la organización y la contraseña de quien cancela. Cierra
     * todas las sesiones: sin suscripción, la base rechaza el contexto de sus usuarios.
     */
    public Instant cancelNow(SubscriptionCancelRequest request) {
        UUID tenantId = context.requireTenantId();
        UUID userId = context.requireUserId();
        Map<String, Object> tenant = requireOperable(tenantId);
        if (!normalize(request.organizationName()).equals(normalize((String) tenant.get("name")))) {
            throw new IllegalArgumentException("El nombre de la organización no coincide");
        }
        User user = users.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)
                .orElseThrow(() -> new AccessDeniedException("Usuario no válido"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("La contraseña no es correcta");
        }
        String subscriptionId = (String) tenant.get("stripe_subscription_id");
        if (subscriptionId != null) {
            releaseScheduleIfAny(tenant);
            // Sin prorrateo ni reembolso automático: el período ya pagado no se devuelve.
            stripe.cancelSubscription(subscriptionId);
        }
        Instant deletionAt = Instant.now().plus(retentionDays, ChronoUnit.DAYS);
        String reason = request.reason() == null || request.reason().isBlank() ? "Cancelada por el administrador" : request.reason().trim();
        jdbc.update("""
                update tenants set subscription_status = 'CANCELED', canceled_at = now(), cancellation_reason = ?,
                  deletion_scheduled_at = ?, cancel_at_period_end = false,
                  stripe_subscription_status = case when stripe_subscription_id is null then stripe_subscription_status else 'canceled' end,
                  scheduled_plan_id = null, scheduled_billing_cycle = null, scheduled_change_at = null, stripe_schedule_id = null
                where id = ?
                """, reason, Timestamp.from(deletionAt), tenantId);
        revokeTenantSessions(tenantId);
        audit(tenantId, "SUBSCRIPTION_CANCELED", Map.of("reason", reason, "deletionScheduledAt", deletionAt.toString()));
        log.info("Organización {} cancelada por {}; borrado programado para {}", tenantId, userId, deletionAt);
        return deletionAt;
    }

    /** Login y refresh: una organización cancelada no entra, pero se explica hasta cuándo se recupera. */
    public void assertTenantAccess(User user) {
        if (user.getTenantId() == null) return;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select subscription_status::text as status, deletion_scheduled_at, purged_at from tenants where id = ?",
                user.getTenantId());
        if (rows.isEmpty()) return;
        Map<String, Object> row = rows.get(0);
        if (row.get("purged_at") != null) throw new AccessDeniedException("La organización fue eliminada definitivamente");
        if ("CANCELED".equals(row.get("status"))) {
            Instant deletion = instant(row.get("deletion_scheduled_at"));
            throw new AccessDeniedException(deletion == null
                    ? "La suscripción de la organización fue cancelada"
                    : "La suscripción de la organización fue cancelada. Sus datos se conservan hasta el "
                      + deletion.toString().substring(0, 10) + "; para recuperarla contacta al soporte de NexoDocs");
        }
    }

    // ------------------------------------------------------------ tareas periódicas

    /** Aplica lo que vence sin Stripe y borra las organizaciones cuyo período de gracia terminó. */
    @Scheduled(fixedDelayString = "${billing.lifecycle.poll-ms:300000}", initialDelayString = "${billing.lifecycle.initial-delay-ms:60000}")
    public void runLifecycle() {
        try {
            finishNonRenewedSubscriptions();
            applyScheduledChanges();
            purgeDueTenants();
        } catch (RuntimeException exception) {
            log.error("Fallo en el ciclo de vida de suscripciones", exception);
        }
    }

    void finishNonRenewedSubscriptions() {
        // Con Stripe lo hace customer.subscription.deleted; aquí solo las suscripciones manuales.
        List<UUID> ended = jdbc.queryForList("""
                update tenants set subscription_status = 'CANCELED', canceled_at = now(),
                  cancellation_reason = coalesce(cancellation_reason, 'No renovada al terminar el período'),
                  deletion_scheduled_at = now() + make_interval(days => ?), cancel_at_period_end = false
                where cancel_at_period_end and stripe_subscription_id is null and current_period_end <= now()
                  and subscription_status in ('TRIAL','ACTIVE','PAST_DUE')
                returning id
                """, UUID.class, retentionDays);
        for (UUID tenantId : ended) {
            revokeTenantSessions(tenantId);
            audit(tenantId, "SUBSCRIPTION_ENDED", Map.of("reason", "not_renewed"));
        }
    }

    void applyScheduledChanges() {
        List<Map<String, Object>> due = jdbc.queryForList("""
                update tenants set plan_id = scheduled_plan_id,
                  billing_cycle_v2 = coalesce(scheduled_billing_cycle, billing_cycle_v2),
                  scheduled_plan_id = null, scheduled_billing_cycle = null, scheduled_change_at = null
                where stripe_subscription_id is null and scheduled_change_at <= now()
                  and subscription_status in ('TRIAL','ACTIVE','PAST_DUE')
                returning id, plan_id
                """);
        for (Map<String, Object> row : due) {
            audit((UUID) row.get("id"), "SUBSCRIPTION_CHANGE_APPLIED", Map.of("planId", row.get("plan_id").toString()));
        }
    }

    void purgeDueTenants() {
        List<UUID> due = jdbc.queryForList("""
                select id from tenants where subscription_status = 'CANCELED' and purged_at is null
                  and deletion_scheduled_at <= now() order by deletion_scheduled_at limit 5
                """, UUID.class);
        for (UUID tenantId : due) purge(tenantId);
    }

    /** Borra datos (función SQL de 061) y, tras confirmarse, los archivos de documentos, OCR y respaldos. */
    void purge(UUID tenantId) {
        try {
            List<String> backupFiles = jdbc.queryForList(
                    "select file_path from tenant_backups where tenant_id = ? and file_path is not null", String.class, tenantId);
            String summary = transaction.execute(status ->
                    jdbc.queryForObject("select app.purge_tenant(?)::text", String.class, tenantId));
            List<Path> targets = new ArrayList<>(List.of(storageRoot.resolve(tenantId.toString()),
                    storageRoot.resolve("ocr").resolve(tenantId.toString())));
            backupFiles.forEach(file -> targets.add(storageRoot.resolve(file)));
            for (Path target : targets) deleteRecursively(target);
            log.info("Organización {} eliminada definitivamente: {}", tenantId, summary);
        } catch (RuntimeException exception) {
            log.error("No se pudo eliminar la organización {}; se reintentará", tenantId, exception);
        }
    }

    // --------------------------------------------------------------- utilidades

    private Map<String, Object> tenantRow(UUID tenantId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select t.name, t.subscription_status::text as subscription_status, t.plan_id, p.code as plan_code,
                  p.name as plan_name, p.price_monthly, p.price_yearly, t.billing_cycle_v2, t.preferred_payment_method,
                  t.current_period_end, t.trial_ends_at, t.stripe_subscription_id, t.stripe_schedule_id,
                  t.cancel_at_period_end, t.scheduled_plan_id, sp.code as scheduled_plan_code, t.scheduled_billing_cycle,
                  t.scheduled_change_at, t.canceled_at, t.deletion_scheduled_at,
                  (select max(b.completed_at) from billing_transactions b
                    where b.tenant_id = t.id and b.status = 'COMPLETED') as last_payment_at
                from tenants t
                left join plans p on p.id = t.plan_id
                left join plans sp on sp.id = t.scheduled_plan_id
                where t.id = ?
                """, tenantId);
        if (rows.isEmpty()) throw new IllegalStateException("Organización no disponible");
        return rows.get(0);
    }

    private Map<String, Object> requireOperable(UUID tenantId) {
        Map<String, Object> tenant = tenantRow(tenantId);
        if (!CANCELABLE.contains(tenant.get("subscription_status"))) {
            throw new IllegalStateException("La suscripción no está vigente (" + tenant.get("subscription_status") + ")");
        }
        return tenant;
    }

    private Map<String, Object> requirePlan(String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("BASIC", "PRO", "ENTERPRISE").contains(normalized)) throw new IllegalArgumentException("Plan no disponible");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select id, code, price_monthly, price_yearly from plans where upper(code) = ? and is_active", normalized);
        if (rows.isEmpty()) throw new IllegalArgumentException("Plan no disponible");
        return rows.get(0);
    }

    private String requireStripePrice(String planCode, String cycle) {
        return properties.priceFor(planCode, cycle).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE, "El plan " + planCode + " no tiene precio de Stripe para el ciclo " + cycle));
    }

    /**
     * Stripe exige el mismo intervalo en todos los ítems: con complementos recurrentes no se cambia de ciclo
     * hasta quitarlos o volver a comprarlos en el ciclo nuevo.
     */
    private static void requireSameCycleForAddons(JsonNode subscription, String targetCycle, String currentCycle) {
        if (!Objects.equals(targetCycle, currentCycle) && !SubscriptionItems.addonItems(subscription).isEmpty()) {
            throw new IllegalStateException("Tienes complementos con ciclo " + ("ANNUAL".equals(currentCycle) ? "anual" : "mensual")
                    + ": quítalos antes de cambiar de ciclo de facturación");
        }
    }

    private void releaseScheduleIfAny(Map<String, Object> tenant) {
        String scheduleId = (String) tenant.get("stripe_schedule_id");
        if (scheduleId == null) return;
        try {
            stripe.releaseSchedule(scheduleId);
        } catch (RuntimeException exception) {
            // Ya liberado o completado en Stripe: no impide la operación pedida.
            log.warn("No se pudo liberar el schedule {}: {}", scheduleId, exception.getMessage());
        }
        // El schedule podía llevar una migración de precio del catálogo (063): sin él ya no se aplica.
        jdbc.update("update tenants set price_change_price_id = null, price_change_at = null where stripe_schedule_id = ?", scheduleId);
    }

    private void grantPlanPermissions(UUID tenantId, UUID planId) {
        try {
            transaction.executeWithoutResult(status -> {
                context.establishDatabaseContext();
                planEnforcement.grantNewPlanPermissionsToAdminRole(tenantId, planId);
            });
        } catch (RuntimeException exception) {
            log.warn("No se pudieron conceder los permisos del plan nuevo a {}: {}", tenantId, exception.getMessage());
        }
    }

    /** Fin del período pagado; sin dato, el último pago más un ciclo, o desde hoy. */
    static Instant periodEnd(Map<String, Object> tenant) {
        Instant end = instant(tenant.get("current_period_end"));
        if (end != null) return end;
        Instant lastPayment = instant(tenant.get("last_payment_at"));
        int days = "ANNUAL".equals(tenant.get("billing_cycle_v2")) ? 365 : 30;
        Instant candidate = (lastPayment == null ? Instant.now() : lastPayment).plus(days, ChronoUnit.DAYS);
        return candidate.isBefore(Instant.now()) ? Instant.now().plus(days, ChronoUnit.DAYS) : candidate;
    }

    private static String cycleOrCurrent(String requested, Map<String, Object> tenant) {
        if (requested != null && !requested.isBlank()) return requested;
        return Objects.toString(tenant.get("billing_cycle_v2"), "MONTHLY");
    }

    private static boolean sameCycle(String cycle, Map<String, Object> tenant) {
        return cycle.equals(Objects.toString(tenant.get("billing_cycle_v2"), "MONTHLY"));
    }

    private static BigDecimal price(Map<String, Object> plan, String cycle) {
        Object value = "ANNUAL".equals(cycle) ? plan.get("price_yearly") : plan.get("price_monthly");
        return value == null ? BigDecimal.ZERO : (BigDecimal) value;
    }

    private static BigDecimal monthly(BigDecimal price, String cycle) {
        return "ANNUAL".equals(cycle) ? price.divide(BigDecimal.valueOf(12), 4, java.math.RoundingMode.HALF_UP) : price;
    }

    private static BigDecimal currentPrice(Map<String, Object> tenant, String cycle) {
        Object value = "ANNUAL".equals(cycle) ? tenant.get("price_yearly") : tenant.get("price_monthly");
        return value == null ? BigDecimal.ZERO : (BigDecimal) value;
    }

    private void revokeTenantSessions(UUID tenantId) {
        jdbc.update("update auth_sessions set revoked_at = now() where tenant_id = ? and revoked_at is null", tenantId);
    }

    /** Evento de auditoría directo: tras cancelar, el contexto RLS del tenant ya no es válido. */
    private void audit(UUID tenantId, String action, Map<String, Object> details) {
        try {
            UUID actor = null;
            try { actor = context.require().tenantId() == null ? null : context.requireUserId(); }
            catch (RuntimeException ignored) { /* tarea programada, sin usuario */ }
            jdbc.update("""
                    insert into audit_events (tenant_id, user_id, action, entity_type, entity_id, result, details)
                    values (?, ?, ?, 'tenants', ?, 'SUCCESS', cast(? as jsonb))
                    """, tenantId, actor, action, tenantId, objectMapper.writeValueAsString(details));
        } catch (Exception exception) {
            log.warn("No se pudo auditar {} de {}: {}", action, tenantId, exception.getMessage());
        }
    }

    private static void deleteRecursively(Path target) {
        if (!Files.exists(target)) return;
        try (Stream<Path> walk = Files.walk(target)) {
            walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); }
                catch (IOException exception) { log.warn("No se pudo borrar {}: {}", path, exception.getMessage()); }
            });
        } catch (IOException exception) {
            log.warn("No se pudo recorrer {}: {}", target, exception.getMessage());
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.time.OffsetDateTime offset) return offset.toInstant();
        if (value instanceof Instant instant) return instant;
        return null;
    }
}
