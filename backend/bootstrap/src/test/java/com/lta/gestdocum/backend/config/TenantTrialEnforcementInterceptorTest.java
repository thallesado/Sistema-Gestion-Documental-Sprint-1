package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.service.PlanEnforcementService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
class TenantTrialEnforcementInterceptorTest {
    @Mock private PlanEnforcementService plans;
    private AuthenticatedUser user;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void keepsTenantReadsOpenForGraceAndChecksWriteAccessForMutations() throws Exception {
        TenantTrialEnforcementInterceptor interceptor = new TenantTrialEnforcementInterceptor(plans);
        authenticateTenant();

        MockHttpServletRequest read = new MockHttpServletRequest("GET", "/api/v1/documents");
        assertTrue(interceptor.preHandle(read, new MockHttpServletResponse(), new Object()));
        verify(plans).validateReadAccess(user.tenantId());

        MockHttpServletRequest write = new MockHttpServletRequest("POST", "/api/v1/documents");
        assertTrue(interceptor.preHandle(write, new MockHttpServletResponse(), new Object()));
        verify(plans).validateWriteAccess(user.tenantId());
    }

    @Test
    void leavesAuthenticationAndPaymentActivationAvailable() throws Exception {
        TenantTrialEnforcementInterceptor interceptor = new TenantTrialEnforcementInterceptor(plans);
        authenticateTenant();

        MockHttpServletRequest auth = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        assertTrue(interceptor.preHandle(auth, new MockHttpServletResponse(), new Object()));
        MockHttpServletRequest payment = new MockHttpServletRequest("POST", "/api/v1/billing/checkout/initiate");
        assertTrue(interceptor.preHandle(payment, new MockHttpServletResponse(), new Object()));
        verifyNoMoreInteractions(plans);
    }

    private void authenticateTenant() {
        user = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "trial-user", Set.of("document:read"));
        var authorities = List.of(new SimpleGrantedAuthority("document:read"));
        SecurityContextHolder.setContext(SecurityContextHolder.createEmptyContext());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, authorities));
    }
}
