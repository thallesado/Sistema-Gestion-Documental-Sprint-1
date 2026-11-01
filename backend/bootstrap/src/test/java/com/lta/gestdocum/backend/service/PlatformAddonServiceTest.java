package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.AddonDtos.*;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PlatformAddonServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformAuditService audit = mock(PlatformAuditService.class);
    private final StripeApiClient stripe = mock(StripeApiClient.class);
    private final StripeBillingProperties properties = mock(StripeBillingProperties.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final ObjectMapper json = new ObjectMapper();
    private PlatformAddonService service;
    private final UUID addonId = UUID.randomUUID();
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(audit.requirePlatformAccount()).thenReturn(new AuthenticatedUser(UUID.randomUUID(), null, "superadmin", Set.of("platform:tenant:manage")));
        service = new PlatformAddonService(jdbc, audit, stripe, properties, transactions);
        when(jdbc.queryForList(contains("from addons where id = ?"), eq(addonId))).thenReturn(List.of(new HashMap<>(Map.of(
                "id", addonId, "code", "STORAGE_10GB", "name", "Almacenamiento adicional", "resource_key", "maxStorageMB",
                "unit_quantity", 10_240L, "kind", "RECURRING", "plan_codes", new String[] {"PRO"}, "is_active", true, "sort_order", 1))));
    }

    private void currentMonthlyPrice(String stripePriceId) {
        Map<String, Object> price = new HashMap<>(Map.of("id", UUID.randomUUID(), "billing_cycle", "MONTHLY",
                "amount_usd", new BigDecimal("9.00"), "effective_from", java.sql.Timestamp.from(Instant.now())));
        price.put("stripe_price_id", stripePriceId);
        price.put("archived_at", null);
        when(jdbc.queryForList(contains("from addon_prices"), eq(addonId))).thenReturn(List.of(price));
    }

    @Test
    void courtesyNeedsReasonAndFutureExpiry() {
        assertThrows(IllegalArgumentException.class, () -> service.grantCourtesy(tenantId,
                new CourtesyGrant("STORAGE_10GB", 1, Instant.now().plus(30, ChronoUnit.DAYS), "")));
        assertThrows(IllegalArgumentException.class, () -> service.grantCourtesy(tenantId,
                new CourtesyGrant("STORAGE_10GB", 1, Instant.now().minus(1, ChronoUnit.DAYS), "Compensación por incidente")));
        verify(jdbc, never()).update(contains("insert into tenant_addons"), any(Object[].class));
    }

    @Test
    void courtesyIsRecordedWithoutChargeAndAudited() {
        when(jdbc.queryForList(contains("from tenants where id = ?"), eq(tenantId))).thenReturn(List.of(Map.of("id", tenantId)));
        when(jdbc.queryForList(contains("from addons where code = ?"), eq("STORAGE_10GB")))
                .thenReturn(List.of(Map.of("id", addonId, "code", "STORAGE_10GB", "kind", "RECURRING", "unit_quantity", 10_240L)));
        Instant expires = Instant.now().plus(60, ChronoUnit.DAYS);
        service.grantCourtesy(tenantId, new CourtesyGrant("storage_10gb", 2, expires, "Compensación por incidente"));
        verify(jdbc).update(contains("'COURTESY'"), any(), eq(tenantId), eq(addonId), eq(2), isNull(), any(java.sql.Timestamp.class),
                eq("Compensación por incidente"), any());
        verifyNoInteractions(stripe);
        verify(audit).record(eq("TENANT_ADDON_GRANTED"), eq(tenantId), eq("Compensación por incidente"), isNull(), any());
    }

    @Test
    void publishingTheSeededPriceCreatesItInStripeWithAddonMetadata() {
        when(properties.configured()).thenReturn(true);
        currentMonthlyPrice(null);
        when(stripe.createProduct(anyMap(), anyString())).thenReturn(json.createObjectNode().put("id", "prod_storage"));
        when(stripe.createPrice(anyMap(), anyString())).thenReturn(json.createObjectNode().put("id", "price_storage"));
        when(jdbc.update(contains("set stripe_price_id"), any(Object[].class))).thenReturn(1);

        service.createPrice(addonId, new AddonPrice("MONTHLY", new BigDecimal("9.00"), "Publicar en Stripe"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> form = ArgumentCaptor.forClass(Map.class);
        verify(stripe).createPrice(form.capture(), anyString());
        assertEquals("STORAGE_10GB", form.getValue().get("metadata[addonCode]"));
        assertEquals("month", form.getValue().get("recurring[interval]"));
        assertEquals("900", form.getValue().get("unit_amount"));
        verify(jdbc, never()).update(contains("insert into addon_prices"), any(Object[].class));
        verify(stripe, never()).updatePrice(anyString(), anyMap());
    }

    @Test
    void consumableOnlyForOcrAndRecurringNeedsBothCycles() {
        assertThrows(IllegalArgumentException.class, () -> service.create(new AddonCreate("USERS_PACK", "Usuarios", null, "maxUsers", 5,
                "CONSUMABLE", 12, List.of("PRO"), Map.of("ONE_TIME", BigDecimal.TEN), "Nuevo paquete")));
        assertThrows(IllegalArgumentException.class, () -> service.create(new AddonCreate("USERS_PACK", "Usuarios", null, "maxUsers", 5,
                "RECURRING", null, List.of("PRO"), Map.of("MONTHLY", BigDecimal.TEN), "Nuevo paquete")));
        assertThrows(IllegalArgumentException.class, () -> PlatformAddonService.validPlans(List.of("PRO", "GOLD")));
        verify(jdbc, never()).update(contains("insert into addons"), any(Object[].class));
    }
}
