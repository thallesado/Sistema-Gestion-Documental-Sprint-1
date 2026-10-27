package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionCancelRequest;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionPlanRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Ciclo de vida de la suscripción: cancelación con confirmación, no renovar, cambio programado y bloqueo de acceso. */
class SubscriptionLifecycleServiceTest {

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID proId = UUID.randomUUID();
    private final UUID basicId = UUID.randomUUID();
    private final Instant periodEnd = Instant.now().plus(12, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

    private JdbcTemplate jdbc;
    private StripeApiClient stripe;
    private PasswordEncoder encoder;
    private PlanEnforcementService planEnforcement;
    private SubscriptionLifecycleService service;
    private Map<String, Object> tenant;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        stripe = mock(StripeApiClient.class);
        encoder = mock(PasswordEncoder.class);
        planEnforcement = mock(PlanEnforcementService.class);
        AuthenticatedUserContext context = mock(AuthenticatedUserContext.class);
        when(context.requireTenantId()).thenReturn(tenantId);
        when(context.requireUserId()).thenReturn(userId);
        when(context.require()).thenReturn(mock(AuthenticatedUser.class));
        UserRepository users = mock(UserRepository.class);
        when(users.findByIdAndTenantIdAndDeletedAtIsNull(userId, tenantId)).thenReturn(Optional.of(
                User.builder().id(userId).tenantId(tenantId).username("admin").email("a@org.test")
                        .passwordHash("hash").status(UserStatus.ACTIVE).build()));
        service = new SubscriptionLifecycleService(jdbc, context, mock(StripeSubscriptionService.class), stripe,
                mock(StripeBillingProperties.class), planEnforcement, users, encoder, new ObjectMapper(),
                mock(PlatformTransactionManager.class), "./target/test-storage", 30);

        tenant = new HashMap<>();
        tenant.put("name", "FinoCode");
        tenant.put("subscription_status", "ACTIVE");
        tenant.put("plan_id", proId);
        tenant.put("plan_code", "PRO");
        tenant.put("price_monthly", new BigDecimal("79.00"));
        tenant.put("price_yearly", new BigDecimal("790.00"));
        tenant.put("billing_cycle_v2", "MONTHLY");
        tenant.put("current_period_end", Timestamp.from(periodEnd));
        tenant.put("cancel_at_period_end", false);
        when(jdbc.queryForList(argThat((String sql) -> sql != null && sql.contains("from tenants t")), eq(tenantId)))
                .thenAnswer(invocation -> List.of(new HashMap<>(tenant)));
        when(jdbc.queryForList(argThat((String sql) -> sql != null && sql.contains("from plans where")), eq("BASIC")))
                .thenReturn(List.of(Map.of("id", basicId, "code", "BASIC",
                        "price_monthly", new BigDecimal("29.00"), "price_yearly", new BigDecimal("290.00"))));
    }

    private SubscriptionCancelRequest cancel(String name, String password) {
        return new SubscriptionCancelRequest(name, password, "Cerramos la empresa");
    }

    @Test
    void cancelRequiresTheExactOrganizationNameAndPassword() {
        assertThrows(IllegalArgumentException.class, () -> service.cancelNow(cancel("Otra", "x")));
        when(encoder.matches("mala", "hash")).thenReturn(false);
        assertThrows(IllegalArgumentException.class, () -> service.cancelNow(cancel("FinoCode", "mala")));
        verify(jdbc, never()).update(contains("subscription_status = 'CANCELED'"), any(Object[].class));
        verifyNoInteractions(stripe);
    }

    @Test
    void cancelSchedulesDeletionAfterTheGracePeriodAndClosesSessions() {
        when(encoder.matches("buena", "hash")).thenReturn(true);
        Instant deletion = service.cancelNow(cancel("  finocode ", "buena"));
        long days = ChronoUnit.DAYS.between(Instant.now(), deletion);
        assertTrue(days >= 29 && days <= 30, "borrado a los 30 días: " + days);
        verify(jdbc).update(contains("subscription_status = 'CANCELED'"), eq("Cerramos la empresa"), any(Timestamp.class), eq(tenantId));
        verify(jdbc).update(contains("update auth_sessions set revoked_at"), eq(tenantId));
        verifyNoInteractions(stripe); // suscripción manual: no hay nada que cancelar en Stripe
    }

    @Test
    void cancelWithStripeCancelsTheSubscriptionFirst() {
        tenant.put("stripe_subscription_id", "sub_123");
        when(encoder.matches("buena", "hash")).thenReturn(true);
        service.cancelNow(cancel("FinoCode", "buena"));
        verify(stripe).cancelSubscription("sub_123");
    }

    @Test
    void upgradeNowNeedsAStripeSubscriptionAndOnlyGoesUp() {
        assertThrows(IllegalStateException.class, () -> service.upgradeNow(new SubscriptionPlanRequest("ENTERPRISE", null)));
        tenant.put("stripe_subscription_id", "sub_123");
        assertThrows(IllegalArgumentException.class, () -> service.upgradeNow(new SubscriptionPlanRequest("BASIC", null)));
        verify(stripe, never()).updateSubscription(any(), any());
    }

    @Test
    void manualScheduledChangeStartsWhenThePaidPeriodEnds() {
        service.scheduleChange(new SubscriptionPlanRequest("BASIC", null));
        verify(jdbc).update(contains("set scheduled_plan_id = ?"), eq(basicId), eq("MONTHLY"),
                eq(Timestamp.from(periodEnd)), isNull(), eq(tenantId));
    }

    @Test
    void aScheduledChangeIsRejectedWhileTheSubscriptionWillNotRenew() {
        tenant.put("cancel_at_period_end", true);
        assertThrows(IllegalStateException.class, () -> service.scheduleChange(new SubscriptionPlanRequest("BASIC", null)));
    }

    @Test
    void stopRenewalKeepsAccessUntilThePeriodEndsAndDropsAnyScheduledChange() {
        service.setAutoRenew(false);
        verify(jdbc).update(contains("set cancel_at_period_end = ?"), eq(true), eq(false), eq(false), eq(false), eq(false), eq(tenantId));
        verifyNoInteractions(stripe);
    }

    @Test
    void canceledOrganizationsCannotLogInAndSeeWhenTheirDataIsDeleted() {
        Instant deletion = Instant.parse("2026-11-26T10:00:00Z");
        Map<String, Object> row = new HashMap<>();
        row.put("status", "CANCELED");
        row.put("deletion_scheduled_at", Timestamp.from(deletion));
        row.put("purged_at", null);
        when(jdbc.queryForList(contains("subscription_status::text as status"), eq(tenantId))).thenReturn(List.of(row));
        User user = User.builder().id(userId).tenantId(tenantId).build();
        AccessDeniedException error = assertThrows(AccessDeniedException.class, () -> service.assertTenantAccess(user));
        assertTrue(error.getMessage().contains("2026-11-26"), error.getMessage());
    }

    @Test
    void periodEndFallsBackToLastPaymentPlusOneCycle() {
        Instant lastPayment = Instant.now().minus(10, ChronoUnit.DAYS);
        Map<String, Object> row = new HashMap<>();
        row.put("last_payment_at", Timestamp.from(lastPayment));
        row.put("billing_cycle_v2", "MONTHLY");
        assertEquals(lastPayment.plus(30, ChronoUnit.DAYS), SubscriptionLifecycleService.periodEnd(row));
    }
}
