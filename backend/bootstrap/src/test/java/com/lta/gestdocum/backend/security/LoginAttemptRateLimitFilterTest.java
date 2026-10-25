package com.lta.gestdocum.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.service.AuthenticationAuditService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LoginAttemptRateLimitFilterTest {
    @Test void fiveFailedHttpLoginsAreAuditedAndSixthIsBlocked() throws Exception {
        var auth = mock(com.lta.gestdocum.backend.service.AuthService.class);
        var audit = mock(AuthenticationAuditService.class);
        when(auth.login(any())).thenThrow(new com.lta.gestdocum.backend.exception.InvalidCredentialsException());
        var controller = new com.lta.gestdocum.backend.controller.AuthController(auth,
                mock(com.lta.gestdocum.backend.service.UserService.class), audit);
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new com.lta.gestdocum.backend.exception.GlobalExceptionHandler())
                .addFilters(new LoginAttemptRateLimitFilter(new ObjectMapper(), audit, 5, 60)).build();
        for (int attempt = 0; attempt < 6; attempt++) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/auth/login")
                    .contentType("application/json")
                    .content("{\"usernameOrEmail\":\"fixture@example.test\",\"password\":\"invalid-fixture\"}"))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status()
                            .is(attempt < 5 ? 401 : 429));
        }
        verify(auth, times(5)).login(any());
        verify(audit, times(6)).recordFailedAuthentication(eq("fixture@example.test"), isNull(), any());
    }
    @Test void windowExpiresAndOtherTenantsHaveIndependentAccountCounters() throws Exception {
        AuthenticationAuditService audit = mock(AuthenticationAuditService.class);
        java.time.Clock clock = mock(java.time.Clock.class);
        when(clock.millis()).thenReturn(1000L);
        LoginAttemptRateLimitFilter filter = new LoginAttemptRateLimitFilter(new ObjectMapper(), audit, 1, 60, clock);
        MockHttpServletRequest first = request("shared-user");
        first.setContent("{\"usernameOrEmail\":\"shared-user\",\"tenantName\":\"Alpha\"}".getBytes(StandardCharsets.UTF_8));
        assertEquals(401, invokeFailing(filter, first).getStatus());
        MockHttpServletRequest second = request("shared-user");
        second.setRemoteAddr("192.0.2.11");
        second.setContent("{\"usernameOrEmail\":\"shared-user\",\"tenantName\":\"Beta\"}".getBytes(StandardCharsets.UTF_8));
        assertEquals(401, invokeFailing(filter, second).getStatus());
        assertEquals(429, invokeFailing(filter, request("another-user")).getStatus());
        when(clock.millis()).thenReturn(61000L);
        assertEquals(401, invokeFailing(filter, request("another-user")).getStatus());
    }

    @Test void oversizedBodyIsRejectedBeforeAuditing() throws Exception {
        AuthenticationAuditService audit = mock(AuthenticationAuditService.class);
        LoginAttemptRateLimitFilter filter = new LoginAttemptRateLimitFilter(new ObjectMapper(), audit, 5, 60);
        MockHttpServletRequest request = request("test");
        request.setContent(new byte[65537]);
        assertEquals(413, invoke(filter, request).getStatus());
        verifyNoInteractions(audit);
    }
    @Test void successfulLoginsDoNotConsumeTheQuota() throws Exception {
        AuthenticationAuditService audit = mock(AuthenticationAuditService.class);
        LoginAttemptRateLimitFilter filter = new LoginAttemptRateLimitFilter(new ObjectMapper(), audit, 3, 60);
        for (int i = 0; i < 20; i++) {
            assertEquals(200, invoke(filter, request("laura@example.test")).getStatus());
        }
        for (int i = 0; i < 3; i++) {
            assertEquals(401, invokeFailing(filter, request("laura@example.test")).getStatus());
        }
        MockHttpServletResponse limited = invokeFailing(filter, request("laura@example.test"));
        assertEquals(429, limited.getStatus());
        assertNotNull(limited.getHeader("Retry-After"));
        verify(audit).recordFailedAuthentication(eq("laura@example.test"), isNull(), any());
    }

    @Test void successAfterFailuresKeepsPreviousFailuresCounted() throws Exception {
        AuthenticationAuditService audit = mock(AuthenticationAuditService.class);
        LoginAttemptRateLimitFilter filter = new LoginAttemptRateLimitFilter(new ObjectMapper(), audit, 2, 60);
        assertEquals(401, invokeFailing(filter, request("laura@example.test")).getStatus());
        assertEquals(200, invoke(filter, request("laura@example.test")).getStatus());
        assertEquals(401, invokeFailing(filter, request("laura@example.test")).getStatus());
        assertEquals(429, invokeFailing(filter, request("laura@example.test")).getStatus());
    }

    @Test void allowsFiveFailuresThenReturns429AndAuditsBlockedAttempt() throws Exception {
        AuthenticationAuditService audit = mock(AuthenticationAuditService.class);
        LoginAttemptRateLimitFilter filter = new LoginAttemptRateLimitFilter(new ObjectMapper(), audit, 5, 60);
        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = invokeFailing(filter, request("laura@example.test"));
            assertEquals(401, response.getStatus());
        }
        MockHttpServletResponse limited = invoke(filter, request("laura@example.test"));
        assertEquals(429, limited.getStatus());
        assertNotNull(limited.getHeader("Retry-After"));
        assertTrue(limited.getContentAsString().contains("Demasiados intentos"));
        verify(audit).recordFailedAuthentication(eq("laura@example.test"), isNull(), any());
    }

    @Test void requestBodyRemainsAvailableToTheController() throws Exception {
        AuthenticationAuditService audit = mock(AuthenticationAuditService.class);
        LoginAttemptRateLimitFilter filter = new LoginAttemptRateLimitFilter(new ObjectMapper(), audit, 5, 60);
        MockHttpServletRequest request = request("person@example.test");
        MockHttpServletResponse response = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chain = (wrapped, result) -> {
            assertTrue(new String(wrapped.getInputStream().readAllBytes(), StandardCharsets.UTF_8)
                    .contains("person@example.test"));
            ((jakarta.servlet.http.HttpServletResponse) result).setStatus(200);
        };
        filter.doFilter(request, response, chain);
        assertEquals(200, response.getStatus());
        verifyNoInteractions(audit);
    }

    private MockHttpServletResponse invokeFailing(LoginAttemptRateLimitFilter filter, MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (wrapped, result) -> ((jakarta.servlet.http.HttpServletResponse) result).setStatus(401));
        return response;
    }

    private MockHttpServletResponse invoke(LoginAttemptRateLimitFilter filter, MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (wrapped, result) -> ((jakarta.servlet.http.HttpServletResponse) result).setStatus(200));
        return response;
    }

    private MockHttpServletRequest request(String identifier) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr("192.0.2.10");
        request.setContentType("application/json");
        request.setContent(("{\"usernameOrEmail\":\"" + identifier + "\",\"password\":\"never-inspected\"}")
                .getBytes(StandardCharsets.UTF_8));
        return request;
    }
}
