package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.billing.StripeApiClient;
import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.PublicSubscriptionCheckoutRequest;
import com.lta.gestdocum.backend.dto.SubscriptionCheckoutSessionResponse;
import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StripeSubscriptionServiceTest {
    @Mock private StripeBillingProperties properties;
    @Mock private StripeApiClient stripe;
    @Mock private JdbcTemplate jdbc;
    @Mock private TenantService tenantService;
    @Mock private PlanRepository plans;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthenticatedUserContext context;
    @Mock private EntityManager entityManager;
    @Mock private PlatformTransactionManager transactionManager;

    private final ObjectMapper mapper = new ObjectMapper();
    private StripeSubscriptionService service;

    @BeforeEach
    void setUp() {
        service = new StripeSubscriptionService(properties, stripe, jdbc, tenantService, plans, passwordEncoder,
                context, entityManager, mapper, transactionManager);
        when(properties.configured()).thenReturn(true);
        when(properties.frontendUrl()).thenReturn("https://app.example");
    }

    @Test
    void signupCheckoutRequiresStripeConfiguration() {
        when(properties.configured()).thenReturn(false);
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createSignupCheckout(request("PRO")));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        verifyNoInteractions(stripe);
    }

    @Test
    void signupCheckoutUsesServerPriceAndKeepsPasswordOutOfStripe() throws Exception {
        Plan plan = plan("PRO");
        when(plans.findFirstByCodeIgnoreCaseAndActiveTrue("PRO")).thenReturn(Optional.of(plan));
        when(properties.priceFor("PRO", "MONTHLY")).thenReturn(Optional.of("price_pro_month"));
        when(passwordEncoder.encode("Secreta123")).thenReturn("$2a$hash");
        when(stripe.createCheckoutSession(anyMap(), anyString()))
                .thenReturn(mapper.readTree("{\"id\":\"cs_test_1\",\"url\":\"https://checkout.stripe.com/c/1\"}"));

        SubscriptionCheckoutSessionResponse response = service.createSignupCheckout(request("PRO"));

        assertEquals("https://checkout.stripe.com/c/1", response.url());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> form = ArgumentCaptor.forClass(Map.class);
        verify(stripe).createCheckoutSession(form.capture(), startsWith("tenant-signup-"));
        assertEquals("subscription", form.getValue().get("mode"));
        assertEquals("price_pro_month", form.getValue().get("line_items[0][price]"));
        assertEquals("tenant_signup", form.getValue().get("subscription_data[metadata][kind]"));
        assertTrue(form.getValue().get("success_url").startsWith("https://app.example/planes/exito"));
        assertFalse(form.getValue().values().stream().anyMatch(v -> v.contains("Secreta123") || v.contains("$2a$hash")));
        // El hash queda solo en la base de datos.
        UUID planId = plan.getId();
        verify(jdbc).update(contains("insert into tenant_signups"), any(), eq(planId), eq("MONTHLY"),
                eq("Clínica Norte"), eq("admin@norte.test"), eq("Ana Pérez"), eq("admin@norte.test"), eq("$2a$hash"));
    }

    @Test
    void signupCheckoutRejectsPlanWithoutConfiguredPrice() {
        Plan enterprise = plan("ENTERPRISE");
        when(plans.findFirstByCodeIgnoreCaseAndActiveTrue("ENTERPRISE")).thenReturn(Optional.of(enterprise));
        when(properties.priceFor("ENTERPRISE", "MONTHLY")).thenReturn(Optional.empty());
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createSignupCheckout(request("ENTERPRISE")));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        verify(jdbc, never()).update(contains("insert into tenant_signups"), any(Object[].class));
    }

    @Test
    void paidSignupCheckoutCreatesTenantWithStoredHash() throws Exception {
        UUID signupId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        when(jdbc.update(contains("status = 'PROVISIONING'"), any(Object[].class))).thenReturn(1);
        when(stripe.retrieveSubscription("sub_1")).thenReturn(mapper.readTree(
                "{\"id\":\"sub_1\",\"status\":\"active\",\"items\":{\"data\":[{\"current_period_end\":1893456000}]}}"));
        when(stripe.retrieveInvoice("in_1")).thenReturn(mapper.readTree(
                "{\"id\":\"in_1\",\"amount_paid\":7900,\"currency\":\"usd\"}"));
        Map<String, Object> signup = new HashMap<>();
        signup.put("tenant_name", "Clínica Norte");
        signup.put("company_email", "contacto@norte.test");
        signup.put("plan_id", planId);
        signup.put("admin_email", "admin@norte.test");
        signup.put("administrator_name", "Ana Pérez");
        signup.put("password_hash", "$2a$hash");
        signup.put("billing_period", "MONTHLY");
        when(jdbc.queryForMap(contains("from tenant_signups"), any(Object[].class))).thenReturn(signup);
        TenantResponse tenant = mock(TenantResponse.class);
        when(tenant.id()).thenReturn(tenantId);
        when(tenantService.createWithPasswordHash(any(TenantCreateRequest.class), eq("$2a$hash"))).thenReturn(tenant);

        assertTrue(service.handleEvent(event("checkout.session.completed", signupId, "paid")));

        ArgumentCaptor<TenantCreateRequest> created = ArgumentCaptor.forClass(TenantCreateRequest.class);
        verify(tenantService).createWithPasswordHash(created.capture(), eq("$2a$hash"));
        assertEquals("Clínica Norte", created.getValue().name());
        assertEquals(planId, created.getValue().planId());
        verify(jdbc).update(contains("insert into billing_transactions"), eq(tenantId), eq(planId), any(), eq("USD"),
                eq("in_1"), eq("MONTHLY"), anyString());
        verify(jdbc).update(contains("status = 'COMPLETED'"), eq(tenantId), eq(signupId));
    }

    @Test
    void repeatedWebhookDoesNotProvisionTwice() throws Exception {
        when(jdbc.update(contains("status = 'PROVISIONING'"), any(Object[].class))).thenReturn(0);
        assertTrue(service.handleEvent(event("checkout.session.completed", UUID.randomUUID(), "paid")));
        verifyNoInteractions(tenantService);
    }

    @Test
    void unpaidAsyncCheckoutWaitsForConfirmation() throws Exception {
        assertTrue(service.handleEvent(event("checkout.session.completed", UUID.randomUUID(), "unpaid")));
        verify(jdbc, never()).update(contains("status = 'PROVISIONING'"), any(Object[].class));
    }

    @Test
    void oneTimePaymentEventsStayWithLegacyFlow() throws Exception {
        assertFalse(service.handleEvent(mapper.readTree(
                "{\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"metadata\":{\"transactionId\":\"x\"}}}}")));
        assertFalse(service.handleEvent(mapper.readTree("{\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{}}}")));
    }

    @Test
    void stripeStatusesMapToTenantAccess() {
        assertEquals("ACTIVE", StripeSubscriptionService.accessStatus("active"));
        assertEquals("PAST_DUE", StripeSubscriptionService.accessStatus("past_due"));
        assertEquals("CANCELED", StripeSubscriptionService.accessStatus("canceled"));
        assertEquals("EXPIRED", StripeSubscriptionService.accessStatus("unpaid"));
        assertEquals("EXPIRED", StripeSubscriptionService.accessStatus("incomplete_expired"));
    }

    private JsonNode event(String type, UUID signupId, String paymentStatus) throws Exception {
        return mapper.readTree("""
                {"type":"%s","data":{"object":{"id":"cs_1","payment_status":"%s","customer":"cus_1",
                 "subscription":"sub_1","invoice":"in_1","metadata":{"kind":"tenant_signup","signupId":"%s"}}}}
                """.formatted(type, paymentStatus, signupId));
    }

    private static PublicSubscriptionCheckoutRequest request(String planCode) {
        return new PublicSubscriptionCheckoutRequest("Clínica Norte", null, "Ana Pérez", "Admin@Norte.test",
                "Secreta123", planCode, null);
    }

    private static Plan plan(String code) {
        Plan plan = mock(Plan.class);
        UUID id = UUID.randomUUID();
        when(plan.getId()).thenReturn(id);
        when(plan.getCode()).thenReturn(code);
        return plan;
    }
}
