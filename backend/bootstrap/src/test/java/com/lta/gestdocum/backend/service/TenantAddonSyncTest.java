package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.billing.SubscriptionItems;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Webhook customer.subscription.updated con un ítem de plan y uno de complemento (064). */
class TenantAddonSyncTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID tenantId = UUID.randomUUID();

    private JsonNode subscription(String status, long addonQuantity) throws Exception {
        // El complemento va primero a propósito: el ítem del plan no es necesariamente data[0].
        String addon = addonQuantity == 0 ? "" : """
                {"id":"si_addon","quantity":%d,"price":{"id":"price_storage","metadata":{"addonCode":"STORAGE_10GB"}}},
                """.formatted(addonQuantity);
        return mapper.readTree("""
                {"id":"sub_1","status":"%s","items":{"data":[%s
                  {"id":"si_plan","quantity":1,"current_period_end":1893456000,"price":{"id":"price_pro","metadata":{},"recurring":{"interval":"month"}}}
                ]}}
                """.formatted(status, addon));
    }

    @Test
    void planItemIsTheOneWithoutAddonMetadata() throws Exception {
        JsonNode subscription = subscription("active", 2);
        assertEquals("si_plan", SubscriptionItems.planItem(subscription).path("id").asText());
        assertEquals(List.of("si_addon"), SubscriptionItems.addonItems(subscription).stream().map(i -> i.path("id").asText()).toList());
        Map<String, String> form = new LinkedHashMap<>();
        SubscriptionItems.putAddonItems(form, 1, 1, SubscriptionItems.addonItems(subscription));
        assertEquals(Map.of("phases[1][items][1][price]", "price_storage", "phases[1][items][1][quantity]", "2"), form);
    }

    @Test
    void webhookUsesThePlanItemAndSyncsAddonItems() throws Exception {
        StripeBillingProperties properties = mock(StripeBillingProperties.class);
        PlanRepository plans = mock(PlanRepository.class);
        StripeApiClient stripe = mock(StripeApiClient.class);
        StripeSubscriptionService service = new StripeSubscriptionService(properties, stripe, jdbc, mock(TenantService.class),
                plans, mock(PasswordEncoder.class), mock(AuthenticatedUserContext.class), mock(EntityManager.class), mapper,
                mock(PlatformTransactionManager.class));
        TenantAddonSync sync = spy(new TenantAddonSync(jdbc));
        service.addonSync = sync;
        JsonNode subscription = subscription("active", 2);
        when(stripe.retrieveSubscription("sub_1")).thenReturn(subscription);
        when(jdbc.queryForList(contains("where stripe_subscription_id = ?"), eq("sub_1"))).thenReturn(List.of(Map.of("id", tenantId)));
        when(properties.planForPrice("price_pro")).thenReturn(Optional.of(new StripeBillingProperties.PlanPrice("PRO", "MONTHLY")));
        Plan pro = mock(Plan.class);
        when(pro.getId()).thenReturn(UUID.randomUUID());
        when(plans.findFirstByCodeIgnoreCase("PRO")).thenReturn(Optional.of(pro));

        service.handleEvent(mapper.readTree("{\"type\":\"customer.subscription.updated\",\"data\":{\"object\":{\"id\":\"sub_1\"}}}"));

        verify(properties).planForPrice("price_pro");
        verify(properties, never()).planForPrice("price_storage");
        verify(sync).sync(eq(tenantId), eq(subscription), eq(Instant.ofEpochSecond(1893456000)));
        // Ítem nuevo (p. ej. desde el portal): se registra el complemento.
        verify(jdbc).update(contains("insert into tenant_addons"), eq(tenantId), eq(2), eq("si_addon"), eq("STORAGE_10GB"));
    }

    @Test
    void moreUnitsApplyNowFewerAtPeriodEnd() {
        TenantAddonSync sync = new TenantAddonSync(jdbc);
        UUID id = UUID.randomUUID();
        Instant end = Instant.parse("2030-01-01T00:00:00Z");
        Map<String, Object> row = new HashMap<>(Map.of("id", id, "units", 2, "status", "ACTIVE"));

        sync.apply(row, 3, end);
        verify(jdbc).update(contains("set units = ?"), eq(3), eq(id));

        sync.apply(row, 1, end);
        verify(jdbc).update(contains("set pending_units = ?"), eq(1), any(java.sql.Timestamp.class), eq(id), eq(1));

        row.put("pending_units", 1);
        sync.apply(row, 2, end);
        verify(jdbc).update(contains("set pending_units = null"), eq(id));
    }

    @Test
    void removedItemEndsAtPeriodEnd() throws Exception {
        TenantAddonSync sync = new TenantAddonSync(jdbc);
        UUID id = UUID.randomUUID();
        when(jdbc.queryForList(contains("stripe_subscription_item_id is not null"), eq(tenantId)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", id, "units", 2, "status", "ACTIVE", "stripe_subscription_item_id", "si_addon"))));
        sync.sync(tenantId, subscription("active", 0), Instant.parse("2030-01-01T00:00:00Z"));
        verify(jdbc).update(contains("set pending_units = ?"), eq(0), any(java.sql.Timestamp.class), eq(id), eq(0));
    }
}
