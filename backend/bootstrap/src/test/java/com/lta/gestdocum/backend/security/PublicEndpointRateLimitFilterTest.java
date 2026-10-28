package com.lta.gestdocum.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class PublicEndpointRateLimitFilterTest {

    private static MockHttpServletResponse invoke(PublicEndpointRateLimitFilter filter, String method, String path)
            throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr("192.0.2.50");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response,
                (req, res) -> ((jakarta.servlet.http.HttpServletResponse) res).setStatus(200));
        return response;
    }

    @Test
    void publicTenantsListKeepsItsOwnLimit() throws Exception {
        PublicEndpointRateLimitFilter filter = new PublicEndpointRateLimitFilter(2, 60, 100, 60);
        assertEquals(200, invoke(filter, "GET", "/api/v1/tenants/public").getStatus());
        assertEquals(200, invoke(filter, "GET", "/api/v1/tenants/public").getStatus());
        MockHttpServletResponse limited = invoke(filter, "GET", "/api/v1/tenants/public");
        assertEquals(429, limited.getStatus());
        assertNotNull(limited.getHeader("Retry-After"));
    }

    @Test
    void signupIsLimitedAndAnswers429WithRetryAfter() throws Exception {
        PublicEndpointRateLimitFilter filter = new PublicEndpointRateLimitFilter(100, 60, 2, 3600);
        assertEquals(200, invoke(filter, "POST", "/api/v1/public/signup").getStatus());
        assertEquals(200, invoke(filter, "POST", "/api/v1/public/signup").getStatus());
        MockHttpServletResponse limited = invoke(filter, "POST", "/api/v1/public/signup");
        assertEquals(429, limited.getStatus());
        assertNotNull(limited.getHeader("Retry-After"));
    }

    @Test
    void onboardingHasItsOwnBucketIndependentFromSignup() throws Exception {
        PublicEndpointRateLimitFilter filter = new PublicEndpointRateLimitFilter(100, 60, 1, 3600);
        assertEquals(200, invoke(filter, "POST", "/api/v1/public/signup").getStatus());
        assertEquals(429, invoke(filter, "POST", "/api/v1/public/signup").getStatus());
        assertEquals(200, invoke(filter, "POST", "/api/v1/public/onboarding").getStatus());
        assertEquals(429, invoke(filter, "POST", "/api/v1/public/onboarding").getStatus());
    }

    @Test
    void otherEndpointsAreNotLimited() throws Exception {
        PublicEndpointRateLimitFilter filter = new PublicEndpointRateLimitFilter(1, 60, 1, 60);
        for (int i = 0; i < 5; i++) {
            assertEquals(200, invoke(filter, "GET", "/api/v1/plans").getStatus());
            assertEquals(200, invoke(filter, "GET", "/api/v1/public/signup").getStatus());
        }
    }
}
