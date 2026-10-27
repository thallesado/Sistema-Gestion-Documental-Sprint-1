package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PlatformTenantOverviewResponse;
import com.lta.gestdocum.backend.dto.PlatformTenantOverviewResponse.*;
import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.exception.PlanLimitExceededException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Ficha de organización y acciones del administrador global (fase 1 del plan de administración).
 * Lee con el usuario de conexión, como PlatformAnalyticsService, y solo devuelve los campos del anexo A:
 * números de uso, nunca nombres ni contenido de documentos o pacientes. Cada acción exige motivo y
 * se registra en platform_audit_events dentro de la misma transacción.
 */
@Service
public class PlatformTenantService {
    private static final Set<String> SUSPENDABLE = Set.of("TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED");
    private static final Set<String> TRIAL_EXTENDABLE = Set.of("TRIAL", "EXPIRED");
    private static final Set<String> PLAN_CHANGEABLE = Set.of("TRIAL", "ACTIVE", "PAST_DUE");
    private static final int MAX_PAYMENTS = 50;
    private static final int MAX_HISTORY = 100;

    private final JdbcTemplate jdbc;
    private final PlatformAuditService audit;
    private final TenantService tenants;
    private final PlanEnforcementService planEnforcement;

    public PlatformTenantService(JdbcTemplate jdbc, PlatformAuditService audit, TenantService tenants,
                                 PlanEnforcementService planEnforcement) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.tenants = tenants;
        this.planEnforcement = planEnforcement;
    }

    // ------------------------------------------------------------------ consulta

    @Transactional(readOnly = true)
    public PlatformTenantOverviewResponse overview(UUID tenantId) {
        audit.requirePlatformAccount();
        Map<String, Object> t = tenantRow(tenantId);
        Summary summary = new Summary(tenantId, str(t.get("name")), str(t.get("code")), str(t.get("slug")),
                str(t.get("email")), str(t.get("phone")), instant(t.get("created_at")), lifecycleState(t));
        Subscription subscription = new Subscription(str(t.get("status")), str(t.get("plan_code")), str(t.get("plan_name")),
                Objects.toString(t.get("billing_cycle_v2"), "MONTHLY"), decimal(t.get("price_monthly")),
                decimal(t.get("price_yearly")), instant(t.get("trial_ends_at")), instant(t.get("current_period_end")),
                t.get("stripe_subscription_id") != null, !Boolean.TRUE.equals(t.get("cancel_at_period_end")),
                str(t.get("scheduled_plan_code")), str(t.get("scheduled_billing_cycle")), instant(t.get("scheduled_change_at")),
                instant(t.get("canceled_at")), str(t.get("cancellation_reason")), instant(t.get("deletion_scheduled_at")),
                instant(t.get("purged_at")), inGracePeriod(t));
        return new PlatformTenantOverviewResponse(summary, administrators(tenantId), subscription,
                usage(tenantId, (UUID) t.get("plan_id")), addons(tenantId), payments(tenantId), history(tenantId));
    }

    // ------------------------------------------------------------------ acciones

    /** Alta manual desde la plataforma; el flujo de creación es el de TenantService. */
    @Transactional
    public TenantResponse create(TenantCreateRequest request, String reason) {
        audit.requirePlatformAccount();
        String normalized = PlatformAuditService.requireReason(reason);
        TenantResponse created = tenants.create(request);
        audit.record("TENANT_CREATED", created.id(), normalized, null,
                mapOf("name", created.name(), "code", created.code(), "status", created.status(), "planId", created.planId()));
        return created;
    }

    /** SUSPENDED suspende; ACTIVE reactiva (suspendida, vencida o cancelada dentro del período de gracia). */
    @Transactional
    public PlatformTenantOverviewResponse changeStatus(UUID tenantId, String requested, String reason) {
        audit.requirePlatformAccount();
        String normalized = PlatformAuditService.requireReason(reason);
        String target = requested == null ? "" : requested.trim().toUpperCase(Locale.ROOT);
        Map<String, Object> t = lockTenant(tenantId);
        String current = str(t.get("status"));
        String action;
        String next;
        if ("SUSPENDED".equals(target)) {
            if (!SUSPENDABLE.contains(current)) throw new IllegalStateException("La organización no se puede suspender en estado " + current);
            next = "SUSPENDED";
            action = "TENANT_SUSPENDED";
        } else if ("ACTIVE".equals(target)) {
            if ("CANCELED".equals(current) && !inGracePeriod(t)) {
                throw new IllegalStateException("El período de gracia terminó: la organización ya no se puede reactivar");
            }
            if (!Set.of("SUSPENDED", "EXPIRED", "CANCELED").contains(current)) {
                throw new IllegalStateException("La organización ya está operativa (" + current + ")");
            }
            // Una prueba suspendida vuelve a prueba; lo demás queda activo.
            Instant trialEnd = instant(t.get("trial_ends_at"));
            boolean trial = "SUSPENDED".equals(current) && t.get("stripe_subscription_id") == null
                    && trialEnd != null && trialEnd.isAfter(Instant.now()) && t.get("last_payment_at") == null;
            next = trial ? "TRIAL" : "ACTIVE";
            action = "TENANT_REACTIVATED";
        } else {
            throw new IllegalArgumentException("Estado no permitido desde la ficha: usa SUSPENDED o ACTIVE");
        }
        tenants.changeStatus(tenantId, next);
        audit.record(action, tenantId, normalized,
                mapOf("status", current, "deletionScheduledAt", str(t.get("deletion_scheduled_at"))),
                mapOf("status", next));
        return overview(tenantId);
    }

    @Transactional
    public PlatformTenantOverviewResponse extendTrial(UUID tenantId, int days, String reason) {
        audit.requirePlatformAccount();
        String normalized = PlatformAuditService.requireReason(reason);
        if (days < 1 || days > 90) throw new IllegalArgumentException("La extensión debe ser de 1 a 90 días");
        Map<String, Object> t = lockTenant(tenantId);
        String current = str(t.get("status"));
        if (!TRIAL_EXTENDABLE.contains(current) || t.get("stripe_subscription_id") != null) {
            throw new IllegalStateException("Solo se extiende la prueba de una organización en prueba o con la prueba vencida");
        }
        Instant previousEnd = instant(t.get("trial_ends_at"));
        Instant base = previousEnd == null || previousEnd.isBefore(Instant.now()) ? Instant.now() : previousEnd;
        Instant newEnd = base.plus(days, ChronoUnit.DAYS);
        jdbc.update("update tenants set trial_ends_at = ?, subscription_status = 'TRIAL' where id = ?",
                Timestamp.from(newEnd), tenantId);
        audit.record("TENANT_TRIAL_EXTENDED", tenantId, normalized,
                mapOf("status", current, "trialEndsAt", previousEnd == null ? null : previousEnd.toString()),
                mapOf("status", "TRIAL", "trialEndsAt", newEnd.toString(), "days", days));
        return overview(tenantId);
    }

    /**
     * Cambio de plan de cortesía o corrección, sin cobro. Una organización que paga con Stripe se cambia
     * desde su suscripción: Stripe es la fuente de verdad y el siguiente webhook revertiría el cambio.
     */
    @Transactional
    public PlatformTenantOverviewResponse changePlan(UUID tenantId, String planCode, boolean acceptOverLimit, String reason) {
        audit.requirePlatformAccount();
        String normalized = PlatformAuditService.requireReason(reason);
        Map<String, Object> t = lockTenant(tenantId);
        String current = str(t.get("status"));
        if (!PLAN_CHANGEABLE.contains(current)) {
            throw new IllegalStateException("La organización no tiene una suscripción vigente (" + current + ")");
        }
        if (t.get("stripe_subscription_id") != null) {
            throw new IllegalStateException("La organización paga con Stripe: el cambio de plan se hace desde su suscripción");
        }
        String code = planCode == null ? "" : planCode.trim().toUpperCase(Locale.ROOT);
        List<Map<String, Object>> plans = jdbc.queryForList(
                "select id, code, name from plans where upper(code) = ? and is_active", code);
        if (plans.isEmpty()) throw new IllegalArgumentException("Plan no disponible");
        UUID targetId = (UUID) plans.get(0).get("id");
        if (targetId.equals(t.get("plan_id"))) throw new IllegalArgumentException("Ese ya es el plan de la organización");

        List<String> exceeded = exceededLimits(usage(tenantId, targetId));
        if (!exceeded.isEmpty() && !acceptOverLimit) {
            throw new PlanLimitExceededException("El uso actual no cabe en el plan " + plans.get(0).get("name") + ": "
                    + String.join(", ", exceeded) + ". Confirma para aplicarlo igualmente; la organización no podrá crecer en esos recursos.");
        }
        jdbc.update("""
                update tenants set plan_id = ?, scheduled_plan_id = null, scheduled_billing_cycle = null,
                  scheduled_change_at = null where id = ?
                """, targetId, tenantId);
        planEnforcement.grantNewPlanPermissionsToAdminRole(tenantId, targetId);
        Map<String, Object> after = mapOf("plan", code);
        if (!exceeded.isEmpty()) after.put("overLimit", exceeded);
        audit.record("TENANT_PLAN_CHANGED", tenantId, normalized, mapOf("plan", str(t.get("plan_code"))), after);
        return overview(tenantId);
    }

    // ---------------------------------------------------------------- secciones

    private List<Contact> administrators(UUID tenantId) {
        return jdbc.queryForList("""
                select distinct u.first_name, u.last_name, u.email, u.status::text as status, u.last_login_at
                from users u
                join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
                join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
                where u.tenant_id = ? and u.deleted_at is null and r.name = 'Administrador de tenant'
                order by u.last_login_at desc nulls last limit 10
                """, tenantId).stream()
                .map(r -> new Contact((str(r.get("first_name")) + " " + str(r.get("last_name"))).trim(),
                        str(r.get("email")), str(r.get("status")), instant(r.get("last_login_at"))))
                .toList();
    }

    /** Solo cantidades: la ficha nunca lee nombres ni contenido de documentos. */
    Usage usage(UUID tenantId, UUID planId) {
        Map<String, Object> used = jdbc.queryForMap("""
                select
                  (select count(*) from users u where u.tenant_id = ? and u.status = 'ACTIVE' and u.deleted_at is null) as users,
                  (select count(*) from documents d where d.tenant_id = ? and d.deleted_at is null) as documents,
                  (select coalesce(sum(v.file_size_bytes), 0) from document_versions v where v.tenant_id = ?) as storage,
                  (select coalesce(max(m.ocr_pages), 0) from tenant_usage_monthly m
                    where m.tenant_id = ? and m.year_month = ?) as ocr
                """, tenantId, tenantId, tenantId, tenantId, LocalDate.now().withDayOfMonth(1));
        Map<String, Long> limits = new HashMap<>();
        if (planId != null) {
            jdbc.queryForList("select resource_key, resource_value from plan_limits where plan_id = ?", planId)
                    .forEach(r -> limits.put(str(r.get("resource_key")), number(r.get("resource_value"))));
        }
        // Límite efectivo: plan más complementos recurrentes activos (064), con el mismo cálculo que la aplicación.
        List<EffectiveLimits.Grant> grants = addonGrants(tenantId);
        Instant now = Instant.now();
        limits.replaceAll((key, value) -> EffectiveLimits.effectiveLimit(value, key, grants, now));
        long storageMb = limits.getOrDefault(PlanLimitService.MAX_STORAGE_MB, -1L);
        return new Usage(
                new UsageItem(number(used.get("users")), limits.getOrDefault(PlanLimitService.MAX_USERS, -1L)),
                new UsageItem(number(used.get("storage")), storageMb == -1 ? -1 : storageMb * 1024L * 1024L),
                new UsageItem(number(used.get("documents")), limits.getOrDefault(PlanLimitService.MAX_DOCUMENTS, -1L)),
                new UsageItem(number(used.get("ocr")), limits.getOrDefault(PlanLimitService.MAX_OCR_PAGES, -1L)));
    }

    private List<EffectiveLimits.Grant> addonGrants(UUID tenantId) {
        try {
            return jdbc.queryForList("""
                    select a.resource_key, a.kind, ta.units, a.unit_quantity, ta.expires_at, coalesce(ta.remaining_quantity, 0) as remaining
                    from tenant_addons ta join addons a on a.id = ta.addon_id where ta.tenant_id = ? and ta.status = 'ACTIVE'
                    """, tenantId).stream()
                    .map(r -> new EffectiveLimits.Grant((String) r.get("resource_key"), (String) r.get("kind"), number(r.get("units")),
                            number(r.get("unit_quantity")), instant(r.get("expires_at")), number(r.get("remaining"))))
                    .toList();
        } catch (org.springframework.dao.DataAccessException missing) {
            return List.of(); // base sin 064
        }
    }

    private List<Addon> addons(UUID tenantId) {
        try {
            return jdbc.queryForList("""
                    select ta.id, a.code, a.name, a.resource_key, a.kind, ta.units, a.unit_quantity, ta.source, ta.expires_at,
                      ta.remaining_quantity, ta.pending_units
                    from tenant_addons ta join addons a on a.id = ta.addon_id
                    where ta.tenant_id = ? and ta.status = 'ACTIVE' order by a.sort_order, ta.created_at
                    """, tenantId).stream()
                    .map(r -> new Addon((UUID) r.get("id"), str(r.get("code")), str(r.get("name")), str(r.get("resource_key")),
                            str(r.get("kind")), ((Number) r.get("units")).intValue(), number(r.get("unit_quantity")), str(r.get("source")),
                            instant(r.get("expires_at")), r.get("remaining_quantity") == null ? null : number(r.get("remaining_quantity")),
                            (Integer) r.get("pending_units")))
                    .toList();
        } catch (org.springframework.dao.DataAccessException missing) {
            return List.of();
        }
    }

    static List<String> exceededLimits(Usage usage) {
        List<String> exceeded = new ArrayList<>();
        if (over(usage.users())) exceeded.add(usage.users().used() + " usuarios activos (máximo " + usage.users().limit() + ")");
        if (over(usage.storageBytes())) {
            exceeded.add((usage.storageBytes().used() / (1024 * 1024)) + " MB almacenados (máximo "
                    + (usage.storageBytes().limit() / (1024 * 1024)) + " MB)");
        }
        if (over(usage.documents())) exceeded.add(usage.documents().used() + " documentos (máximo " + usage.documents().limit() + ")");
        return exceeded;
    }

    private static boolean over(UsageItem item) { return item.limit() != -1 && item.used() > item.limit(); }

    private List<Payment> payments(UUID tenantId) {
        return jdbc.queryForList("""
                select b.id, b.created_at, b.completed_at, coalesce(pl.name, 'Sin plan') as plan_name, b.payment_method,
                  b.status, b.billing_period, b.amount_usd, b.external_reference
                from billing_transactions b left join plans pl on pl.id = b.plan_id
                where b.tenant_id = ? order by b.created_at desc limit ?
                """, tenantId, MAX_PAYMENTS).stream()
                .map(r -> new Payment((UUID) r.get("id"), instant(r.get("created_at")), instant(r.get("completed_at")),
                        str(r.get("plan_name")), str(r.get("payment_method")), str(r.get("status")),
                        str(r.get("billing_period")), decimal(r.get("amount_usd")), str(r.get("external_reference"))))
                .toList();
    }

    /**
     * Acciones de plataforma más eventos del ciclo de vida de la suscripción. De audit_events solo se
     * lee la acción y la fecha de los eventos de suscripción: el detalle de la auditoría interna del
     * tenant no se expone (anexo A).
     */
    private List<HistoryEvent> history(UUID tenantId) {
        List<HistoryEvent> events = new ArrayList<>();
        for (Map<String, Object> row : audit.forTenant(tenantId, MAX_HISTORY)) {
            events.add(new HistoryEvent(instant(row.get("occurredAt")), "PLATFORM", str(row.get("action")),
                    str(row.get("actor")), str(row.get("reason"))));
        }
        jdbc.queryForList("""
                select occurred_at, action from audit_events
                where tenant_id = ? and entity_type = 'tenants'
                  and (action like 'SUBSCRIPTION\\_%' or action = 'TENANT_PURGED')
                order by occurred_at desc limit ?
                """, tenantId, MAX_HISTORY)
                .forEach(r -> events.add(new HistoryEvent(instant(r.get("occurred_at")), "LIFECYCLE", str(r.get("action")), null, null)));
        events.sort(Comparator.comparing(HistoryEvent::occurredAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return events.size() > MAX_HISTORY ? List.copyOf(events.subList(0, MAX_HISTORY)) : List.copyOf(events);
    }

    // --------------------------------------------------------------- utilidades

    private Map<String, Object> tenantRow(UUID tenantId) {
        List<Map<String, Object>> rows = jdbc.queryForList(TENANT_SQL, tenantId);
        if (rows.isEmpty()) throw new NotFoundException("Organización no encontrada");
        return rows.get(0);
    }

    /** Bloquea la fila del tenant para que dos acciones simultáneas no partan del mismo estado. */
    private Map<String, Object> lockTenant(UUID tenantId) {
        jdbc.queryForList("select id from tenants where id = ? for update", tenantId);
        Map<String, Object> t = tenantRow(tenantId);
        if (t.get("purged_at") != null) throw new IllegalStateException("La organización fue eliminada definitivamente");
        return t;
    }

    private static final String TENANT_SQL = """
            select t.id, t.name, t.code, t.slug, t.email, t.phone, t.created_at, t.subscription_status::text as status,
              t.plan_id, p.code as plan_code, p.name as plan_name, p.price_monthly, p.price_yearly, t.billing_cycle_v2,
              t.trial_ends_at, t.current_period_end, t.stripe_subscription_id, t.cancel_at_period_end,
              sp.code as scheduled_plan_code, t.scheduled_billing_cycle, t.scheduled_change_at, t.canceled_at,
              t.cancellation_reason, t.deletion_scheduled_at, t.purged_at,
              (select max(b.completed_at) from billing_transactions b
                where b.tenant_id = t.id and b.status = 'COMPLETED') as last_payment_at
            from tenants t
            left join plans p on p.id = t.plan_id
            left join plans sp on sp.id = t.scheduled_plan_id
            where t.id = ?
            """;

    static boolean inGracePeriod(Map<String, Object> t) {
        Instant deletion = instant(t.get("deletion_scheduled_at"));
        return "CANCELED".equals(str(t.get("status"))) && t.get("purged_at") == null
                && deletion != null && deletion.isAfter(Instant.now());
    }

    /** Estado del ciclo de vida para la ficha: el de la suscripción más borrado programado o realizado. */
    static String lifecycleState(Map<String, Object> t) {
        if (t.get("purged_at") != null) return "PURGED";
        if (inGracePeriod(t)) return "PENDING_DELETION";
        return Objects.toString(t.get("status"), "TRIAL");
    }

    private static Map<String, Object> mapOf(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], pairs[i + 1]);
        return map;
    }

    private static String str(Object value) { return value == null ? null : value.toString(); }

    private static long number(Object value) { return value == null ? 0 : ((Number) value).longValue(); }

    private static BigDecimal decimal(Object value) { return value == null ? null : new BigDecimal(value.toString()); }

    static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Timestamp ts) return ts.toInstant();
        if (value instanceof OffsetDateTime odt) return odt.toInstant();
        if (value instanceof Instant i) return i;
        return Instant.parse(value.toString());
    }
}
