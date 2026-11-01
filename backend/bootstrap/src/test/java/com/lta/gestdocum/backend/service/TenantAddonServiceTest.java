package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.PaymentGatewayProvider;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.AddonDtos.Purchase;
import com.lta.gestdocum.backend.dto.AddonDtos.UnitsChange;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TenantAddonServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AuthenticatedUserContext context = mock(AuthenticatedUserContext.class);
    private final StripeApiClient stripe = mock(StripeApiClient.class);
    private final StripeBillingProperties properties = mock(StripeBillingProperties.class);
    private final TenantAddonSync sync = mock(TenantAddonSync.class);
    private TenantAddonService service;
    private final UUID tenantId = UUID.randomUUID();
    private final UUID planId = UUID.randomUUID();
    private final UUID addonId = UUID.randomUUID();
    private final Map<String, Object> tenant = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new TenantAddonService(jdbc, context, stripe, properties, sync, List.<PaymentGatewayProvider>of(), mapper);
        when(context.requireTenantId()).thenReturn(tenantId);
        when(context.requireUserId()).thenReturn(UUID.randomUUID());
        when(properties.configured()).thenReturn(true);
        tenant.putAll(Map.of("id", tenantId, "status", "ACTIVE", "plan_id", planId, "plan_code", "PRO",
                "price_monthly", new BigDecimal("79.00"), "billing_cycle_v2", "MONTHLY", "email", "admin@norte.test",
                "stripe_subscription_id", "sub_1"));
        tenant.put("current_period_end", java.sql.Timestamp.from(Instant.now().plus(20, ChronoUnit.DAYS)));
        when(jdbc.queryForList(contains("from tenants t left join plans p"), eq(tenantId))).thenAnswer(i -> List.of(tenant));
        when(jdbc.queryForList(contains("from plan_limits"), eq(planId)))
                .thenReturn(List.of(Map.of("resource_key", "maxStorageMB", "resource_value", 25_600L)));
        when(jdbc.queryForList(contains("from addons\n"), anyString(), eq("PRO"))).thenReturn(List.of(Map.of(
                "id", addonId, "code", "STORAGE_10GB", "name", "Almacenamiento adicional", "kind", "RECURRING",
                "resource_key", "maxStorageMB", "unit_quantity", 10_240L)));
        when(jdbc.queryForList(contains("from addon_prices where addon_id"), eq(addonId), eq("MONTHLY"))).thenReturn(List.of(
                new HashMap<>(Map.of("id", UUID.randomUUID(), "amount_usd", new BigDecimal("9.00"), "stripe_price_id", "price_storage"))));
    }

    private void usageMb(long megabytes) {
        when(jdbc.queryForMap(contains("document_versions"), eq(tenantId), eq(tenantId), eq(tenantId)))
                .thenReturn(Map.of("users", 3L, "bytes", megabytes * 1024 * 1024, "ocr", 0L));
    }

    @Test
    void recurringAddonIsAddedToTheSameStripeSubscription() throws Exception {
        JsonNode subscription = mapper.readTree("""
                {"id":"sub_1","items":{"data":[{"id":"si_plan","quantity":1,"price":{"id":"price_pro","metadata":{}}}]}}
                """);
        when(stripe.retrieveSubscription("sub_1")).thenReturn(subscription);
        usageMb(0);

        var result = service.purchase(new Purchase("storage_10gb", 1, "STRIPE_CARD", null));

        assertEquals("SUBSCRIPTION_ITEM", result.mode());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> form = ArgumentCaptor.forClass(Map.class);
        verify(stripe).createSubscriptionItem(form.capture(), anyString());
        assertEquals("sub_1", form.getValue().get("subscription"));
        assertEquals("price_storage", form.getValue().get("price"));
        assertEquals("1", form.getValue().get("quantity"));
        assertEquals("always_invoice", form.getValue().get("proration_behavior"));
        assertEquals("STORAGE_10GB", form.getValue().get("metadata[addonCode]"));
        verify(sync).sync(eq(tenantId), any(), any());
    }

    @Test
    void trialTenantsCannotBuy() {
        tenant.put("status", "TRIAL");
        assertThrows(IllegalStateException.class, () -> service.purchase(new Purchase("STORAGE_10GB", 1, "STRIPE_CARD", null)));
        verifyNoInteractions(stripe);
    }

    @Test
    void removingAnAddonInUseIsRejectedWithAClearMessage() {
        UUID owned = UUID.randomUUID();
        when(jdbc.queryForList(contains("where ta.id = ? and ta.tenant_id = ?"), eq(owned), eq(tenantId))).thenReturn(List.of(Map.of(
                "id", owned, "units", 1, "stripe_subscription_item_id", "si_addon", "addon_id", addonId, "code", "STORAGE_10GB",
                "resource_key", "maxStorageMB", "unit_quantity", 10_240L, "kind", "RECURRING")));
        when(jdbc.queryForObject(contains("ta.id <> ?"), eq(Long.class), eq(tenantId), eq(owned), eq("maxStorageMB"))).thenReturn(0L);
        usageMb(30_000); // por encima de los 25 600 MB del plan

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> service.changeUnits(owned, new UnitsChange(0)));
        assertTrue(error.getMessage().contains("No puedes quitar esas unidades"));
        verify(stripe, never()).deleteSubscriptionItem(anyString(), anyString());

        usageMb(20_000);
        service.changeUnits(owned, new UnitsChange(0));
        verify(stripe).deleteSubscriptionItem("si_addon", "none");
        verify(jdbc).update(contains("set pending_units = ?"), eq(0), any(java.sql.Timestamp.class), eq(owned));
    }

    @Test
    void paidPackIsCreditedOnceAndRecordedAsRevenue() throws Exception {
        JsonNode session = mapper.readTree("""
                {"id":"cs_test_123456789","payment_status":"paid","amount_total":2000,"payment_intent":"pi_1",
                 "metadata":{"kind":"tenant_addon","tenantId":"%s","addonId":"%s","units":"1"}}
                """.formatted(tenantId, addonId));
        when(jdbc.update(contains("insert into tenant_addons"), any(Object[].class))).thenReturn(1, 0);

        assertTrue(service.handleStripeEvent(mapper.createObjectNode().put("type", "checkout.session.completed")
                .set("data", mapper.createObjectNode().set("object", session))));
        service.grantPaidCheckout(session);

        verify(jdbc, times(1)).update(contains("insert into billing_transactions"), eq(new BigDecimal("20.00")), eq("pi_1"),
                eq(addonId.toString()), eq(1), eq("cs_test_123456789"), eq(tenantId));
        assertFalse(service.handleStripeEvent(mapper.readTree("{\"type\":\"invoice.paid\",\"data\":{\"object\":{}}}")));
    }

    @Test
    void suggestsUpgradeWhenAddonsCostMoreThanTheNextPlan() {
        when(jdbc.queryForObject(contains("sum(ta.units * p.amount_usd)"), eq(BigDecimal.class), eq("MONTHLY"), eq(tenantId)))
                .thenReturn(new BigDecimal("135.00"));
        when(jdbc.queryForList(contains("p.sort_order > current.sort_order"), eq(planId)))
                .thenReturn(List.of(Map.of("code", "ENTERPRISE", "name", "Empresarial", "price_monthly", new BigDecimal("199.00"))));
        var suggestion = service.upgradeSuggestion(tenant, "MONTHLY", tenantId);
        assertNotNull(suggestion);
        assertEquals("ENTERPRISE", suggestion.planCode());
        assertEquals(new BigDecimal("120.00"), suggestion.planDifferenceMonthlyUsd());

        when(jdbc.queryForObject(contains("sum(ta.units * p.amount_usd)"), eq(BigDecimal.class), eq("MONTHLY"), eq(tenantId)))
                .thenReturn(new BigDecimal("9.00"));
        assertNull(service.upgradeSuggestion(tenant, "MONTHLY", tenantId));
    }
}
