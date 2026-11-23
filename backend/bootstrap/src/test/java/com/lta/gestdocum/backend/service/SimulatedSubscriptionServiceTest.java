package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.repository.PlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class SimulatedSubscriptionServiceTest {

    @Mock private PublicSignupService signup;
    @Mock private PlanRepository planRepository;
    @Mock private JdbcTemplate jdbc;
    @Mock private StripeBillingProperties properties;

    private SimulatedSubscriptionService service;

    @BeforeEach
    void setUp() {
        when(properties.frontendUrl()).thenReturn("http://localhost:4200");
        service = new SimulatedSubscriptionService(signup, planRepository, jdbc, properties);
    }

    @Test
    void createSignupCheckout_PersistsSimulatedPaymentViaSecureFunction() {
        UUID planId = UUID.randomUUID();
        Plan plan = mock(Plan.class);
        when(plan.getId()).thenReturn(planId);
        when(plan.getCode()).thenReturn("PRO");
        when(plan.getPriceMonthly()).thenReturn(new BigDecimal("79.00"));
        when(plan.getPriceYearly()).thenReturn(new BigDecimal("790.00"));
        when(planRepository.findFirstByCodeIgnoreCaseAndActiveTrue("PRO")).thenReturn(Optional.of(plan));

        UUID tenantId = UUID.randomUUID();
        PublicSignupResponse signupResponse = new PublicSignupResponse(
                tenantId, "Clinica Demo", "admin", "admin@demo.test", null, true, "SIM-REF", "OK", null
        );
        when(signup.signupForCheckout(any())).thenReturn(signupResponse);

        UUID signupId = UUID.randomUUID();
        when(jdbc.queryForObject(
                eq("SELECT app.record_simulated_signup_payment(?, ?, ?, ?, ?, ?, ?, ?, ?)"),
                eq(UUID.class),
                eq(tenantId),
                eq(planId),
                eq("MONTHLY"),
                eq("Clinica Demo"),
                eq("admin@demo.test"),
                eq("Admin User"),
                eq("admin@demo.test"),
                anyString(),
                eq(new BigDecimal("79.00"))
        )).thenReturn(signupId);

        PublicSubscriptionCheckoutRequest request = new PublicSubscriptionCheckoutRequest(
                "Clinica Demo", "admin@demo.test", "Admin User", "admin@demo.test", "Password123!", "PRO", "MONTHLY"
        );

        SubscriptionCheckoutSessionResponse sessionResponse = service.createSignupCheckout(request);

        assertNotNull(sessionResponse);
        assertTrue(sessionResponse.sessionId().startsWith("sim_"));
        assertEquals("http://localhost:4200/planes/exito?session_id=" + sessionResponse.sessionId(), sessionResponse.url());
        verify(jdbc, times(1)).queryForObject(
                eq("SELECT app.record_simulated_signup_payment(?, ?, ?, ?, ?, ?, ?, ?, ?)"),
                eq(UUID.class),
                eq(tenantId), eq(planId), eq("MONTHLY"), eq("Clinica Demo"),
                eq("admin@demo.test"), eq("Admin User"), eq("admin@demo.test"),
                anyString(), eq(new BigDecimal("79.00"))
        );
    }

    @Test
    void signupStatus_QueriesStatusViaSecureFunction() {
        String session = "sim_test123456";
        UUID tenantId = UUID.randomUUID();
        Map<String, Object> row = new HashMap<>();
        row.put("status", "COMPLETED");
        row.put("tenant_name", "Clinica Demo");
        row.put("tenant_id", tenantId);

        when(jdbc.queryForList("SELECT status, tenant_name, tenant_id FROM app.get_simulated_signup_status(?)", session))
                .thenReturn(List.of(row));

        PublicSubscriptionStatusResponse response = service.signupStatus(session);

        assertNotNull(response);
        assertEquals("COMPLETED", response.status());
        assertEquals("Clinica Demo", response.tenantName());
        assertEquals(tenantId, response.tenantId());
        assertTrue(response.message().contains("Pago completado"));
    }

    @Test
    void signupStatus_ThrowsWhenNotFound() {
        when(jdbc.queryForList("SELECT status, tenant_name, tenant_id FROM app.get_simulated_signup_status(?)", "unknown"))
                .thenReturn(Collections.emptyList());

        assertThrows(IllegalArgumentException.class, () -> service.signupStatus("unknown"));
    }
}
