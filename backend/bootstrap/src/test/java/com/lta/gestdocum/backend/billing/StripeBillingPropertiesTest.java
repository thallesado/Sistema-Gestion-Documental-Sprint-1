package com.lta.gestdocum.backend.billing;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StripeBillingPropertiesTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MockEnvironment environment = new MockEnvironment().withProperty("app.stripe.prices.pro-monthly", "price_env");

    @SuppressWarnings("unchecked")
    private StripeBillingProperties properties() {
        ObjectProvider<JdbcTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(jdbc);
        return new StripeBillingProperties("rk_test_x", "http://localhost:4200", environment, provider);
    }

    @Test
    void currentCatalogVersionWinsOverEnvironment() {
        when(jdbc.queryForList(contains("pp.archived_at is null"), eq("PRO"), eq("MONTHLY")))
                .thenReturn(List.of(Map.of("stripe_price_id", "price_catalog")));
        assertEquals(Optional.of("price_catalog"), properties().priceFor("pro", "monthly"));
    }

    @Test
    void environmentIsTheFallbackWithoutACatalogVersion() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        assertEquals(Optional.of("price_env"), properties().priceFor("PRO", "MONTHLY"));
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenThrow(new DataAccessResourceFailureException("sin 063"));
        assertEquals(Optional.of("price_env"), properties().priceFor("PRO", "MONTHLY"));
        assertEquals(Optional.of("price_env"), new StripeBillingProperties("rk_test_x", "http://x", environment).priceFor("PRO", "MONTHLY"));
    }

    @Test
    void archivedVersionsStillMapToTheirPlan() {
        when(jdbc.queryForList(contains("where pp.stripe_price_id = ?"), eq("price_2025")))
                .thenReturn(List.of(Map.of("code", "pro", "billing_cycle", "ANNUAL")));
        assertEquals(Optional.of(new StripeBillingProperties.PlanPrice("PRO", "ANNUAL")), properties().planForPrice("price_2025"));
        when(jdbc.queryForList(contains("where pp.stripe_price_id = ?"), eq("price_env"))).thenReturn(List.of());
        assertEquals(Optional.of(new StripeBillingProperties.PlanPrice("PRO", "MONTHLY")), properties().planForPrice("price_env"));
    }
}
