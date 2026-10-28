package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PlatformTenantOverviewResponse.Usage;
import com.lta.gestdocum.backend.dto.PlatformTenantOverviewResponse.UsageItem;
import com.lta.gestdocum.backend.exception.PlanLimitExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PlatformTenantServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PlatformAuditService audit = mock(PlatformAuditService.class);
    private final TenantService tenants = mock(TenantService.class);
    private final PlanEnforcementService planEnforcement = mock(PlanEnforcementService.class);
    private PlatformTenantService service;
    private final UUID tenantId = UUID.randomUUID();
    private final Map<String, Object> tenant = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new PlatformTenantService(jdbc, audit, tenants, planEnforcement);
        tenant.put("id", tenantId);
        tenant.put("name", "Clínica Norte");
        tenant.put("status", "ACTIVE");
        tenant.put("plan_code", "PRO");
        when(jdbc.queryForList(contains("from tenants t"), eq(tenantId))).thenAnswer(i -> List.of(tenant));
        usage(0L);
    }

    private void usage(long users) {
        when(jdbc.queryForMap(anyString(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of("users", users, "documents", 0L, "storage", 0L, "ocr", 0L));
    }

    @Test
    void actionsWithoutReasonDoNothing() {
        assertThrows(IllegalArgumentException.class, () -> service.changeStatus(tenantId, "SUSPENDED", ""));
        assertThrows(IllegalArgumentException.class, () -> service.extendTrial(tenantId, 7, null));
        assertThrows(IllegalArgumentException.class, () -> service.changePlan(tenantId, "BASIC", false, "ok"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
        verify(tenants, never()).changeStatus(any(), any());
        verify(audit, never()).record(any(), any(), any(), any(), any());
    }

    @Test
    void tenantAccountIsRejectedBeforeAnyRead() {
        when(audit.requirePlatformAccount()).thenThrow(new AccessDeniedException("no"));
        assertThrows(AccessDeniedException.class, () -> service.overview(tenantId));
        assertThrows(AccessDeniedException.class, () -> service.changeStatus(tenantId, "SUSPENDED", "Motivo válido"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void suspendIsAuditedWithBeforeAndAfter() {
        service.changeStatus(tenantId, "SUSPENDED", "Impago reiterado");
        verify(tenants).changeStatus(tenantId, "SUSPENDED");
        verify(audit).record(eq("TENANT_SUSPENDED"), eq(tenantId), eq("Impago reiterado"),
                argThat(m -> "ACTIVE".equals(m.get("status"))), argThat(m -> "SUSPENDED".equals(m.get("status"))));
    }

    @Test
    void canceledTenantOutsideGracePeriodCannotBeReactivated() {
        tenant.put("status", "CANCELED");
        tenant.put("deletion_scheduled_at", Timestamp.from(Instant.now().minus(1, ChronoUnit.DAYS)));
        assertThrows(IllegalStateException.class, () -> service.changeStatus(tenantId, "ACTIVE", "Cliente volvió"));
        tenant.put("deletion_scheduled_at", Timestamp.from(Instant.now().plus(5, ChronoUnit.DAYS)));
        service.changeStatus(tenantId, "ACTIVE", "Cliente volvió");
        verify(tenants).changeStatus(tenantId, "ACTIVE");
        verify(audit).record(eq("TENANT_REACTIVATED"), eq(tenantId), any(), any(), any());
    }

    @Test
    void trialExtensionOnlyForTrialWithoutStripe() {
        assertThrows(IllegalStateException.class, () -> service.extendTrial(tenantId, 7, "Pidió más tiempo"));
        tenant.put("status", "TRIAL");
        assertThrows(IllegalArgumentException.class, () -> service.extendTrial(tenantId, 91, "Pidió más tiempo"));
        service.extendTrial(tenantId, 7, "Pidió más tiempo");
        verify(jdbc).update(contains("trial_ends_at"), any(Timestamp.class), eq(tenantId));
        verify(audit).record(eq("TENANT_TRIAL_EXTENDED"), eq(tenantId), any(), any(),
                argThat(m -> Integer.valueOf(7).equals(m.get("days"))));
    }

    @Test
    void manualPlanChangeIsRejectedForStripeAndWarnsWhenUsageDoesNotFit() {
        tenant.put("stripe_subscription_id", "sub_123");
        assertThrows(IllegalStateException.class, () -> service.changePlan(tenantId, "BASIC", false, "Cortesía comercial"));
        tenant.remove("stripe_subscription_id");
        UUID basic = UUID.randomUUID();
        when(jdbc.queryForList(contains("from plans where"), eq("BASIC")))
                .thenReturn(List.of(Map.of("id", basic, "code", "BASIC", "name", "Básico")));
        usage(12L);
        when(jdbc.queryForList(contains("from plan_limits"), eq(basic)))
                .thenReturn(List.of(Map.of("resource_key", "maxUsers", "resource_value", 5L)));
        assertThrows(PlanLimitExceededException.class, () -> service.changePlan(tenantId, "BASIC", false, "Cortesía comercial"));
        verify(audit, never()).record(any(), any(), any(), any(), any());

        service.changePlan(tenantId, "BASIC", true, "Cortesía comercial");
        verify(planEnforcement).grantNewPlanPermissionsToAdminRole(tenantId, basic);
        verify(audit).record(eq("TENANT_PLAN_CHANGED"), eq(tenantId), any(), any(), argThat(m -> m.containsKey("overLimit")));
    }

    @Test
    void unlimitedResourcesNeverExceed() {
        assertTrue(PlatformTenantService.exceededLimits(new Usage(new UsageItem(999, -1), new UsageItem(1L << 40, -1),
                new UsageItem(5, 5), new UsageItem(10, 1))).isEmpty());
    }
}
