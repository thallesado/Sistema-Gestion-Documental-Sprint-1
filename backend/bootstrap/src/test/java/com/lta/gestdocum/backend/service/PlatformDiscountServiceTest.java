package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.DiscountDtos.*;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PlatformDiscountServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformAuditService audit = mock(PlatformAuditService.class);
    private final StripeApiClient stripe = mock(StripeApiClient.class);
    private final StripeBillingProperties properties = mock(StripeBillingProperties.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final ObjectMapper json = new ObjectMapper();
    private PlatformDiscountService service;
    private final UUID couponId = UUID.randomUUID();
    private final UUID tenantId = UUID.randomUUID();
    private static final BigDecimal CAP = new BigDecimal("50");

    @BeforeEach
    void setUp() {
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(audit.requirePlatformAccount()).thenReturn(new AuthenticatedUser(UUID.randomUUID(), null, "superadmin", Set.of("platform:tenant:manage")));
        when(properties.configured()).thenReturn(true);
        when(jdbc.queryForObject(contains("count(*)"), eq(Long.class), any())).thenReturn(0L);
        when(jdbc.queryForObject(contains("min(price_monthly)"), eq(BigDecimal.class), any())).thenReturn(new BigDecimal("49.00"));
        service = new PlatformDiscountService(jdbc, audit, stripe, properties, transactions, CAP, 12);
    }

    private CouponCreate coupon(BigDecimal percent, BigDecimal amount, String duration, Integer months, Instant redeemBy, String reason) {
        return new CouponCreate("LANZ-20", "Lanzamiento", percent, amount, duration, months, List.of("PRO"), redeemBy, reason);
    }

    private static Instant inDays(int days) { return Instant.now().plus(days, ChronoUnit.DAYS); }

    @Test
    void couponWithoutEndDateIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(new BigDecimal("20"), null, "ONCE", null, null, "Campaña de lanzamiento")));
        assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(new BigDecimal("20"), null, "ONCE", null, Instant.now().minus(1, ChronoUnit.DAYS), "Campaña de lanzamiento")));
        verifyNoInteractions(stripe);
    }

    @Test
    void couponWithoutEndingDurationIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(new BigDecimal("20"), null, "FOREVER", null, inDays(30), "Campaña de lanzamiento")));
        assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(new BigDecimal("20"), null, "REPEATING", null, inDays(30), "Campaña de lanzamiento")));
        verifyNoInteractions(stripe);
    }

    @Test
    void couponAboveCapIsRejected() {
        IllegalArgumentException percent = assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(new BigDecimal("60"), null, "ONCE", null, inDays(30), "Campaña de lanzamiento")));
        assertTrue(percent.getMessage().contains("tope de 50 %"));
        // 50 % de 49 USD = 24,50: un monto fijo de 30 lo supera.
        IllegalArgumentException amount = assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(null, new BigDecimal("30"), "ONCE", null, inDays(30), "Campaña de lanzamiento")));
        assertTrue(amount.getMessage().contains("24.50"));
        verifyNoInteractions(stripe);
    }

    @Test
    void couponNeedsReasonAndOneValueType() {
        assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(new BigDecimal("20"), null, "ONCE", null, inDays(30), "")));
        assertThrows(IllegalArgumentException.class, () -> service.createCoupon(
                coupon(new BigDecimal("20"), new BigDecimal("5"), "ONCE", null, inDays(30), "Campaña de lanzamiento")));
        verifyNoInteractions(stripe);
    }

    @Test
    @SuppressWarnings("unchecked")
    void validCouponIsCreatedInStripeFirstAndAudited() throws Exception {
        when(stripe.createCoupon(anyMap(), anyString())).thenReturn(json.readTree("{\"id\":\"co_123\"}"));
        Instant redeemBy = inDays(30);
        service.createCoupon(coupon(new BigDecimal("20"), null, "REPEATING", 3, redeemBy, "Campaña de lanzamiento"));

        ArgumentCaptor<Map<String, String>> form = ArgumentCaptor.forClass(Map.class);
        verify(stripe).createCoupon(form.capture(), eq("nexodocs-coupon-LANZ-20"));
        assertEquals("20", form.getValue().get("percent_off"));
        assertEquals("repeating", form.getValue().get("duration"));
        assertEquals("3", form.getValue().get("duration_in_months"));
        assertEquals(Long.toString(redeemBy.getEpochSecond()), form.getValue().get("redeem_by"));
        var order = inOrder(stripe, jdbc);
        order.verify(stripe).createCoupon(anyMap(), anyString());
        order.verify(jdbc).update(contains("insert into coupons"), any(Object[].class));
        verify(audit).record(eq("COUPON_CREATED"), isNull(), eq("Campaña de lanzamiento"), isNull(), anyMap());
    }

    @Test
    void stripeFailureSavesNothing() {
        when(stripe.createCoupon(anyMap(), anyString())).thenThrow(new IllegalStateException("Stripe caído"));
        assertThrows(IllegalStateException.class, () -> service.createCoupon(
                coupon(new BigDecimal("20"), null, "ONCE", null, inDays(30), "Campaña de lanzamiento")));
        verify(jdbc, never()).update(contains("insert into coupons"), any(Object[].class));
        verify(audit, never()).record(anyString(), any(), anyString(), any(), any());
    }

    @Test
    void promotionCodeCannotOutliveItsCoupon() {
        Instant redeemBy = inDays(30);
        assertThrows(IllegalArgumentException.class, () -> PlatformDiscountService.validatePromotionCode(inDays(31), redeemBy));
        assertThrows(IllegalArgumentException.class, () -> PlatformDiscountService.validatePromotionCode(null, redeemBy));
        assertDoesNotThrow(() -> PlatformDiscountService.validatePromotionCode(inDays(10), redeemBy));
    }

    @Test
    void tenantDiscountRequiresStripeSubscriptionAndReason() {
        stubCoupon();
        Map<String, Object> tenant = new HashMap<>();
        tenant.put("status", "ACTIVE");
        tenant.put("stripe_subscription_id", null);
        tenant.put("plan_code", "PRO");
        when(jdbc.queryForList(contains("from tenants t left join plans"), eq(tenantId))).thenReturn(List.of(tenant));

        assertThrows(IllegalArgumentException.class, () -> service.applyToTenant(tenantId, new TenantDiscountApply(couponId, "")));
        assertThrows(IllegalStateException.class, () -> service.applyToTenant(tenantId,
                new TenantDiscountApply(couponId, "Cliente frecuente desde 2025")));
        verify(stripe, never()).updateSubscription(anyString(), anyMap());
    }

    @Test
    void tenantDiscountIsAppliedInStripeAndAuditedWithApprover() throws Exception {
        stubCoupon();
        Map<String, Object> tenant = new HashMap<>();
        tenant.put("status", "ACTIVE");
        tenant.put("stripe_subscription_id", "sub_1");
        tenant.put("plan_code", "PRO");
        tenant.put("current_period_end", Timestamp.from(inDays(20)));
        tenant.put("billing_cycle_v2", "MONTHLY");
        when(jdbc.queryForList(contains("from tenants t left join plans"), eq(tenantId))).thenReturn(List.of(tenant));
        when(stripe.updateSubscription(eq("sub_1"), anyMap())).thenReturn(json.readTree("{\"id\":\"sub_1\",\"status\":\"active\"}"));

        service.applyToTenant(tenantId, new TenantDiscountApply(couponId, "Cliente frecuente desde 2025"));

        verify(stripe).updateSubscription("sub_1", Map.of("discounts[0][coupon]", "co_123"));
        verify(jdbc).update(contains("insert into tenant_discounts"), any(Object[].class));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> after = ArgumentCaptor.forClass(Map.class);
        verify(audit).record(eq("TENANT_DISCOUNT_APPLIED"), eq(tenantId), eq("Cliente frecuente desde 2025"), isNull(), after.capture());
        assertEquals("superadmin", after.getValue().get("approvedBy"));
    }

    @Test
    void discountForAnotherPlanIsRejected() {
        stubCoupon();
        Map<String, Object> tenant = new HashMap<>();
        tenant.put("status", "ACTIVE");
        tenant.put("stripe_subscription_id", "sub_1");
        tenant.put("plan_code", "BASIC");
        when(jdbc.queryForList(contains("from tenants t left join plans"), eq(tenantId))).thenReturn(List.of(tenant));
        assertThrows(IllegalArgumentException.class, () -> service.applyToTenant(tenantId,
                new TenantDiscountApply(couponId, "Cliente frecuente desde 2025")));
        verify(stripe, never()).updateSubscription(anyString(), anyMap());
    }

    private void stubCoupon() {
        Map<String, Object> coupon = new HashMap<>();
        coupon.put("id", couponId);
        coupon.put("code", "FIEL-10");
        coupon.put("percent_off", new BigDecimal("10.00"));
        coupon.put("duration", "REPEATING");
        coupon.put("duration_in_months", 12);
        coupon.put("plan_codes", new String[] {"PRO"});
        coupon.put("redeem_by", Timestamp.from(inDays(60)));
        coupon.put("stripe_coupon_id", "co_123");
        coupon.put("is_active", true);
        when(jdbc.queryForList(contains("from coupons where id = ?"), eq(couponId))).thenReturn(List.of(coupon));
    }
}
