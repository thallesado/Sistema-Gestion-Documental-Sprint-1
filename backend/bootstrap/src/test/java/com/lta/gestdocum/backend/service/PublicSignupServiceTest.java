package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.PublicSignupRequest;
import com.lta.gestdocum.backend.dto.PublicSignupResponse;
import com.lta.gestdocum.backend.dto.TenantCreateRequest;
import com.lta.gestdocum.backend.dto.TenantResponse;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.model.SubscriptionPayment;
import com.lta.gestdocum.backend.model.Tenant;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.SubscriptionPaymentRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class PublicSignupServiceTest {

    @Mock private TenantService tenantService;
    @Mock private TenantRepository tenantRepository;
    @Mock private PlanRepository planRepository;
    @Mock private SubscriptionPaymentRepository subscriptionPaymentRepository;
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthService authService;

    private PublicSignupService signupService;

    @BeforeEach
    void setUp() {
        signupService = new PublicSignupService(
                tenantService,
                tenantRepository,
                planRepository,
                subscriptionPaymentRepository,
                userRepository,
                passwordEncoder,
                authService
        );
    }

    @Test
    void signup_WithSimulatedPayment_CreatesTenantAndRecordsPayment() {
        UUID planId = UUID.randomUUID();
        Plan plan = mock(Plan.class);
        when(plan.getId()).thenReturn(planId);
        when(plan.getCode()).thenReturn("PRO");
        when(plan.getPriceMonthly()).thenReturn(new BigDecimal("79.00"));
        when(planRepository.findFirstByCodeIgnoreCaseAndActiveTrue("PRO")).thenReturn(Optional.of(plan));

        UUID tenantId = UUID.randomUUID();
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setName("Clinica Dental Los Andes");
        tenant.setStatus(Tenant.Status.TRIAL);

        when(tenantService.create(any(TenantCreateRequest.class))).thenReturn(
                new TenantResponse(tenantId, "Clinica Dental Los Andes", "ORG-1234", "clinica-dental", "TRIAL", planId, null, null)
        );
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-custom-password");

        User admin = User.builder().id(UUID.randomUUID()).tenantId(tenantId).username("admin-dental").email("admin@dental.test").build();
        when(userRepository.findByTenantAndIdentifier(eq(tenantId), eq("admin@dental.test"))).thenReturn(Optional.of(admin));

        when(authService.login(any())).thenReturn(new AuthResponse("jwt-token", "Bearer", "refresh-token", 3600L, Collections.emptyList()));

        PublicSignupRequest request = new PublicSignupRequest(
                "Clinica Dental Los Andes",
                "ORG-DENTAL",
                "clinica-dental",
                "info@dental.test",
                planId,
                "PRO",
                "Dra. Laura",
                "admin@dental.test",
                "ClaveSecreta#2026",
                "SIMULATED_CARD",
                new BigDecimal("79.00"),
                "MONTHLY"
        );

        PublicSignupResponse response = signupService.signup(request);

        assertNotNull(response);
        assertEquals(tenantId, response.tenantId());
        assertTrue(response.simulatedPayment());
        assertTrue(response.paymentReference().startsWith("SIM-"));
        assertEquals(Tenant.Status.ACTIVE, tenant.getStatus());

        // Verificar registro del pago simulado en subscription_payments
        ArgumentCaptor<SubscriptionPayment> paymentCaptor = ArgumentCaptor.forClass(SubscriptionPayment.class);
        verify(subscriptionPaymentRepository).save(paymentCaptor.capture());
        SubscriptionPayment payment = paymentCaptor.getValue();
        assertEquals(tenantId, payment.getTenantId());
        assertEquals("COMPLETED", payment.getStatus());
        assertTrue(payment.isSimulated());
    }
}
