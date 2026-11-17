package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Códigos promocionales en el checkout: un código vencido, agotado o ajeno al plan se rechaza con claridad. */
class PromotionServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ObjectMapper json = new ObjectMapper();
    private PromotionService service;
    private Map<String, Object> code;

    @BeforeEach
    void setUp() {
        service = new PromotionService(jdbc);
        code = new HashMap<>();
        code.put("id", UUID.randomUUID());
        code.put("code", "LANZAMIENTO2026");
        code.put("stripe_promotion_code_id", "promo_1");
        code.put("max_redemptions", 10);
        code.put("expires_at", Timestamp.from(Instant.now().plus(10, ChronoUnit.DAYS)));
        code.put("first_time_only", true);
        code.put("code_active", true);
        code.put("name", "Lanzamiento");
        code.put("percent_off", new BigDecimal("20.00"));
        code.put("duration", "REPEATING");
        code.put("duration_in_months", 3);
        code.put("plan_codes", new String[] {"PRO"});
        code.put("redeem_by", Timestamp.from(Instant.now().plus(20, ChronoUnit.DAYS)));
        code.put("coupon_active", true);
        code.put("redemptions", 2L);
        when(jdbc.queryForList(contains("from promotion_codes pc join coupons"), eq("LANZAMIENTO2026"))).thenReturn(List.of(code));
        when(jdbc.queryForList(contains("from plans"), eq(BigDecimal.class), eq("PRO"))).thenReturn(List.of(new BigDecimal("49.00")));
    }

    @Test
    void validCodeReturnsTheFirstPaymentWithDiscount() {
        PromotionService.ResolvedCode resolved = service.resolve(" lanzamiento2026 ", "pro", "MONTHLY", null);
        assertEquals("promo_1", resolved.stripePromotionCodeId());
        assertEquals(new BigDecimal("49.00"), resolved.preview().priceUsd());
        assertEquals(new BigDecimal("39.20"), resolved.preview().firstPaymentUsd());
    }

    @Test
    void expiredCodeIsRejectedWithItsDate() {
        code.put("expires_at", Timestamp.from(Instant.now().minus(1, ChronoUnit.DAYS)));
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.resolve("LANZAMIENTO2026", "PRO", "MONTHLY", null));
        assertTrue(error.getMessage().contains("venció el"), error.getMessage());
    }

    @Test
    void exhaustedCodeIsRejected() {
        code.put("redemptions", 10L);
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.resolve("LANZAMIENTO2026", "PRO", "MONTHLY", null));
        assertTrue(error.getMessage().contains("límite de canjes"));
    }

    @Test
    void unknownInactiveOrForeignPlanCodesAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.resolve("NOEXISTE", "PRO", "MONTHLY", null));
        assertThrows(IllegalArgumentException.class, () -> service.resolve("LANZAMIENTO2026", "BASIC", "MONTHLY", null));
        code.put("coupon_active", false);
        assertThrows(IllegalArgumentException.class, () -> service.resolve("LANZAMIENTO2026", "PRO", "MONTHLY", null));
    }

    @Test
    void firstTimeCodeIsRejectedForAPayingTenant() {
        UUID tenant = UUID.randomUUID();
        when(jdbc.queryForObject(contains("from billing_transactions"), eq(Long.class), eq(tenant))).thenReturn(3L);
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.resolve("LANZAMIENTO2026", "PRO", "MONTHLY", tenant));
        assertTrue(error.getMessage().contains("primer pago"));
    }

    @Test
    void discountMathNeverGoesBelowZero() {
        assertEquals(new BigDecimal("0.00"), PromotionService.discounted(new BigDecimal("10.00"), null, new BigDecimal("15.00")));
        assertEquals(new BigDecimal("5.00"), PromotionService.discounted(new BigDecimal("10.00"), new BigDecimal("50"), null));
    }

    @Test
    void discountEndsAfterTheChargedPeriodOrTheMonths() {
        Instant start = Instant.parse("2026-01-15T00:00:00Z");
        assertEquals(Instant.parse("2026-04-15T00:00:00Z"), PromotionService.discountEnd("REPEATING", 3, start, null, "MONTHLY"));
        Instant periodEnd = Instant.parse("2026-02-15T00:00:00Z");
        assertEquals(periodEnd, PromotionService.discountEnd("ONCE", null, start, periodEnd, "MONTHLY"));
        assertEquals(start.atZone(ZoneOffset.UTC).plusMonths(12).toInstant(), PromotionService.discountEnd("ONCE", null, start, null, "ANNUAL"));
    }

    @Test
    void subscriptionWithoutDiscountEndsTheActiveOne() throws Exception {
        UUID tenant = UUID.randomUUID();
        service.syncFromSubscription(tenant, json.readTree("{\"id\":\"sub_1\",\"discounts\":[]}"));
        verify(jdbc).update(contains("set status = 'ENDED'"), eq(tenant));
        reset(jdbc);
        service.syncFromSubscription(tenant, json.readTree("{\"id\":\"sub_1\",\"discounts\":[\"di_1\"]}"));
        service.syncFromSubscription(tenant, json.readTree("{\"id\":\"sub_1\"}"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void invoiceDiscountIsAttributed() throws Exception {
        UUID tenant = UUID.randomUUID();
        UUID discount = UUID.randomUUID();
        when(jdbc.queryForList(contains("from tenant_discounts"), eq(UUID.class), eq(tenant))).thenReturn(List.of(discount));
        Map<String, Object> meta = service.invoiceAttribution(tenant,
                json.readTree("{\"total_discount_amounts\":[{\"amount\":980,\"discount\":\"di_1\"}]}"));
        assertEquals(new BigDecimal("9.80"), meta.get("discountUsd"));
        assertEquals(discount.toString(), meta.get("tenantDiscountId"));
        assertTrue(service.invoiceAttribution(tenant, json.readTree("{\"total_discount_amounts\":[]}")).isEmpty());
    }
}
