package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.PlatformPlanDtos.*;
import com.lta.gestdocum.backend.exception.ConfirmationRequiredException;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PlatformPlanServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformAuditService audit = mock(PlatformAuditService.class);
    private final PlanEnforcementService planEnforcement = mock(PlanEnforcementService.class);
    private final StripeApiClient stripe = mock(StripeApiClient.class);
    private final StripeBillingProperties properties = mock(StripeBillingProperties.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final ObjectMapper json = new ObjectMapper();
    private PlatformPlanService service;
    private final UUID planId = UUID.randomUUID();
    private final UUID currentPriceId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(audit.requirePlatformAccount()).thenReturn(new AuthenticatedUser(UUID.randomUUID(), null, "superadmin",
                Set.of("platform:tenant:manage")));
        service = new PlatformPlanService(jdbc, audit, planEnforcement, stripe, properties, transactions, null, "no-reply@test");
        Map<String, Object> plan = new HashMap<>(Map.of("id", planId, "code", "PRO", "name", "Profesional", "is_active", true, "sort_order", 2));
        when(jdbc.queryForList(contains("from plans where id = ?"), eq(planId))).thenReturn(List.of(plan));
        when(jdbc.queryForList(contains("from plan_limits"), eq(planId)))
                .thenReturn(List.of(Map.of("resource_key", "maxUsers", "resource_value", 100L)));
        when(jdbc.queryForList(contains("from plan_features"), eq(planId)))
                .thenReturn(List.of(new HashMap<>(Map.of("feature_key", "workflows", "is_enabled", true, "description", "Flujos"))));
        when(jdbc.queryForObject(contains("count(*) from tenants where plan_id"), eq(Long.class), eq(planId))).thenReturn(3L);
    }

    private void currentPrice(String stripePriceId) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", currentPriceId);
        row.put("amount_usd", new BigDecimal("79.00"));
        row.put("stripe_price_id", stripePriceId);
        when(jdbc.queryForList(contains("archived_at is null"), eq(planId), eq("MONTHLY"))).thenReturn(List.of(row));
    }

    @Test
    void everyChangeRequiresAReasonAndAPlatformAccount() {
        assertThrows(IllegalArgumentException.class, () -> service.updatePlan(planId, new PlanUpdate("Pro", null, true, 1, "")));
        assertThrows(IllegalArgumentException.class, () -> service.createPriceVersion(planId, new PriceCreate("MONTHLY", BigDecimal.TEN, "x")));
        when(audit.requirePlatformAccount()).thenThrow(new AccessDeniedException("no"));
        assertThrows(AccessDeniedException.class, () -> service.list());
        verifyNoInteractions(stripe);
        verify(audit, never()).record(any(), any(), any(), any(), any());
    }

    @Test
    void loweringALimitThatTenantsExceedAsksForConfirmation() {
        when(jdbc.queryForList(contains("> ?"), eq(String.class), eq(planId), eq(10L))).thenReturn(List.of("Clínica Norte"));
        ConfirmationRequiredException warning = assertThrows(ConfirmationRequiredException.class,
                () -> service.updateLimits(planId, new LimitsUpdate(Map.of("maxUsers", 10L), false, "Ajuste de catálogo")));
        assertEquals(1, warning.affected());
        assertEquals(List.of("Clínica Norte"), warning.examples());
        verify(jdbc, never()).update(contains("plan_limits"), any(Object[].class));

        service.updateLimits(planId, new LimitsUpdate(Map.of("maxUsers", 10L), true, "Ajuste de catálogo"));
        verify(jdbc).update(contains("insert into plan_limits"), eq(planId), eq("maxUsers"), eq(10L), eq("users"));
        verify(audit).record(eq("PLAN_LIMITS_UPDATED"), isNull(), eq("Ajuste de catálogo"), any(),
                argThat(m -> Integer.valueOf(1).equals(m.get("tenantsOverLimit"))));
    }

    @Test
    void unknownLimitsAndFeaturesAreRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.updateLimits(planId, new LimitsUpdate(Map.of("maxRockets", 1L), true, "Ajuste de catálogo")));
        assertThrows(IllegalArgumentException.class,
                () -> service.updateLimits(planId, new LimitsUpdate(Map.of("maxUsers", -5L), true, "Ajuste de catálogo")));
        assertThrows(IllegalArgumentException.class,
                () -> service.updateFeatures(planId, new FeaturesUpdate(Map.of("teleport", true), true, "Ajuste de catálogo")));
    }

    @Test
    void removingAFeatureWarnsAndEnablingOneGrantsAdminPermissions() {
        assertThrows(ConfirmationRequiredException.class,
                () -> service.updateFeatures(planId, new FeaturesUpdate(Map.of("workflows", false), false, "Retiro de workflows")));
        service.updateFeatures(planId, new FeaturesUpdate(Map.of("workflows", false), true, "Retiro de workflows"));
        verify(jdbc).update(contains("update plan_features"), eq(false), eq(planId), eq("workflows"));
        verify(planEnforcement, never()).grantNewPlanPermissionsToAdminRole(any(), any());

        when(jdbc.queryForList(contains("from plan_features"), eq(planId)))
                .thenReturn(List.of(new HashMap<>(Map.of("feature_key", "workflows", "is_enabled", false, "description", "Flujos"))));
        UUID tenant = UUID.randomUUID();
        when(jdbc.queryForList(contains("select id from tenants where plan_id"), eq(UUID.class), eq(planId))).thenReturn(List.of(tenant));
        service.updateFeatures(planId, new FeaturesUpdate(Map.of("workflows", true), false, "Vuelven los workflows"));
        verify(planEnforcement).grantNewPlanPermissionsToAdminRole(tenant, planId);
    }

    @Test
    void basicCannotBeWithdrawnFromSale() {
        when(jdbc.queryForList(contains("from plans where id = ?"), eq(planId)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", planId, "code", "BASIC", "name", "Básico", "is_active", true, "sort_order", 1))));
        assertThrows(IllegalStateException.class, () -> service.updatePlan(planId, new PlanUpdate("Básico", null, false, 1, "Retirar de venta")));
    }

    @Test
    void newPriceIsCreatedInStripeFirstAndTheOldOneArchivedAfterTheDatabase() {
        when(properties.configured()).thenReturn(true);
        currentPrice(null);
        when(properties.environmentPriceFor("PRO", "MONTHLY")).thenReturn(Optional.of("price_env_old"));
        when(stripe.retrievePrice("price_env_old")).thenReturn(json.createObjectNode().put("id", "price_env_old").put("product", "prod_1"));
        when(stripe.createPrice(anyMap(), anyString())).thenReturn(json.createObjectNode().put("id", "price_new"));

        service.createPriceVersion(planId, new PriceCreate("MONTHLY", new BigDecimal("89"), "Ajuste por inflación"));

        ArgumentCaptor<Map<String, String>> form = ArgumentCaptor.forClass(Map.class);
        verify(stripe).createPrice(form.capture(), anyString());
        assertEquals("8900", form.getValue().get("unit_amount"));
        assertEquals("month", form.getValue().get("recurring[interval]"));
        assertEquals("prod_1", form.getValue().get("product"));
        var order = inOrder(stripe, jdbc);
        order.verify(stripe).createPrice(anyMap(), anyString());
        order.verify(jdbc).update(contains("set stripe_price_id"), eq("price_env_old"), eq(currentPriceId));
        order.verify(jdbc).update(contains("set archived_at"), eq(currentPriceId));
        order.verify(jdbc).update(contains("insert into plan_prices"), eq(planId), eq("MONTHLY"), eq(new BigDecimal("89.00")), eq("price_new"), any());
        order.verify(jdbc).update(contains("price_monthly"), eq(new BigDecimal("89.00")), eq(planId));
        order.verify(stripe).updatePrice("price_env_old", Map.of("active", "false"));
        verify(audit).record(eq("PLAN_PRICE_CHANGED"), isNull(), eq("Ajuste por inflación"), any(), any());
    }

    @Test
    void stripeFailureSavesNothing() {
        when(properties.configured()).thenReturn(true);
        currentPrice("price_old");
        when(stripe.retrievePrice("price_old")).thenReturn(json.createObjectNode().put("id", "price_old").put("product", "prod_1"));
        when(stripe.createPrice(anyMap(), anyString())).thenThrow(new IllegalStateException("Stripe caído"));
        assertThrows(IllegalStateException.class,
                () -> service.createPriceVersion(planId, new PriceCreate("MONTHLY", new BigDecimal("89"), "Ajuste por inflación")));
        verify(jdbc, never()).update(contains("plan_prices"), any(Object[].class));
        verify(audit, never()).record(any(), any(), any(), any(), any());
    }

    @Test
    void databaseFailureArchivesTheJustCreatedStripePrice() {
        when(properties.configured()).thenReturn(true);
        currentPrice("price_old");
        when(stripe.retrievePrice("price_old")).thenReturn(json.createObjectNode().put("id", "price_old").put("product", "prod_1"));
        when(stripe.createPrice(anyMap(), anyString())).thenReturn(json.createObjectNode().put("id", "price_new"));
        when(jdbc.update(contains("insert into plan_prices"), any(Object[].class))).thenThrow(new IllegalStateException("db"));
        assertThrows(IllegalStateException.class,
                () -> service.createPriceVersion(planId, new PriceCreate("MONTHLY", new BigDecimal("89"), "Ajuste por inflación")));
        verify(stripe).updatePrice("price_new", Map.of("active", "false"));
        verify(stripe, never()).updatePrice(eq("price_old"), anyMap());
    }

    @Test
    void samePriceIsRejected() {
        currentPrice("price_old");
        assertThrows(IllegalArgumentException.class,
                () -> service.createPriceVersion(planId, new PriceCreate("MONTHLY", new BigDecimal("79.00"), "Sin cambio real")));
        verifyNoInteractions(stripe);
    }

    @Test
    void migrationSkipsTenantsWithPendingChanges() {
        UUID priceId = UUID.randomUUID();
        Map<String, Object> tenant = new HashMap<>();
        tenant.put("price_change_price_id", priceId);
        assertEquals("La migración ya está programada", PlatformPlanService.skipReason(tenant, priceId));
        tenant.put("price_change_price_id", null);
        tenant.put("cancel_at_period_end", true);
        assertEquals("No renovará la suscripción", PlatformPlanService.skipReason(tenant, priceId));
        tenant.put("cancel_at_period_end", false);
        tenant.put("stripe_schedule_id", "sub_sched_1");
        assertEquals("Tiene un cambio de plan programado", PlatformPlanService.skipReason(tenant, priceId));
        tenant.put("stripe_schedule_id", null);
        assertNull(PlatformPlanService.skipReason(tenant, priceId));
    }

    @Test
    void migrationGivesAtLeastThirtyDaysOfNotice() {
        when(properties.configured()).thenReturn(true);
        UUID priceId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        Map<String, Object> target = new HashMap<>(Map.of("id", priceId, "plan_id", planId, "billing_cycle", "MONTHLY",
                "amount_usd", new BigDecimal("89.00"), "stripe_price_id", "price_new", "plan_name", "Profesional"));
        target.put("archived_at", null);
        when(jdbc.queryForList(contains("from plan_prices pp join plans p"), eq(priceId))).thenReturn(List.of(target));
        Map<String, Object> tenant = new HashMap<>(Map.of("id", tenantId, "name", "Clínica Norte", "email", "admin@norte.test",
                "stripe_subscription_id", "sub_1", "cancel_at_period_end", false));
        when(jdbc.queryForList(contains("t.plan_price_id is distinct from"), eq(planId), eq("MONTHLY"), eq(priceId))).thenReturn(List.of(tenant));
        ObjectNode subscription = json.createObjectNode();
        ObjectNode item = subscription.putObject("items").putArray("data").addObject();
        item.put("quantity", 1).putObject("price").put("id", "price_old");
        when(stripe.retrieveSubscription("sub_1")).thenReturn(subscription);
        long end = Instant.now().plus(10, ChronoUnit.DAYS).getEpochSecond();
        ObjectNode schedule = json.createObjectNode().put("id", "sub_sched_1");
        schedule.putArray("phases").addObject().put("start_date", end - 2_000_000).put("end_date", end);
        when(stripe.createScheduleFromSubscription("sub_1")).thenReturn(schedule);
        when(stripe.updateSchedule(eq("sub_sched_1"), anyMap())).thenReturn(json.createObjectNode().put("id", "sub_sched_1"));

        MigrationResult result = service.migrateSubscribers(priceId, "Migración a la tarifa 2027");

        assertEquals(1, result.scheduled());
        ArgumentCaptor<Map<String, String>> form = ArgumentCaptor.forClass(Map.class);
        verify(stripe).updateSchedule(eq("sub_sched_1"), form.capture());
        // Faltan 10 días para renovar: se mantiene una renovación más con el precio actual.
        assertEquals("price_old", form.getValue().get("phases[1][items][0][price]"));
        assertEquals("price_new", form.getValue().get("phases[2][items][0][price]"));
        verify(jdbc).update(contains("insert into audit_events"), eq(tenantId), any(), eq(tenantId), eq("89.00 USD"), anyString());
        verify(jdbc).update(contains("insert into notifications"), anyString(), eq(tenantId));
        verify(audit).record(eq("PLAN_PRICE_MIGRATION_SCHEDULED"), eq(tenantId), eq("Migración a la tarifa 2027"), any(),
                argThat(m -> Instant.parse((String) m.get("effectiveAt")).isAfter(Instant.now().plus(29, ChronoUnit.DAYS))));
    }
}
