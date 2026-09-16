package com.lta.gestdocum.backend.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void propagatesTypedIdentityAndAuthorities() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        AuthenticatedUser identity = new AuthenticatedUser(
                UUID.randomUUID(), UUID.randomUUID(), "user", Set.of("user:read"));
        when(jwtService.extractAuthenticatedUser("valid")).thenReturn(identity);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users");
        request.addHeader("Authorization", "Bearer valid");
        FilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals(identity, SecurityContextHolder.getContext().getAuthentication().getPrincipal());
        assertTrue(SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("user:read")));
    }
}
