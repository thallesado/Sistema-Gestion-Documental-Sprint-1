package com.lta.gestdocum.backend.security;

import com.lta.gestdocum.backend.service.SupportAccessService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SupportSessionFilterTest {
    private final SupportAccessService support = mock(SupportAccessService.class);
    private final SupportSessionFilter filter = new SupportSessionFilter(support);
    private final AuthenticatedUser session = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "soporte",
            Set.of("document:read", PlatformAuthorities.SUPPORT_SESSION), UUID.randomUUID());

    @AfterEach
    void clear() { SecurityContextHolder.clearContext(); }

    private void authenticate(AuthenticatedUser user) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    @Test
    void onlyReadsInsideTheTenantAreAllowed() {
        assertTrue(SupportSessionFilter.allowed("GET", "/api/v1/documents"));
        assertTrue(SupportSessionFilter.allowed("POST", "/api/v1/auth/logout"));
        assertFalse(SupportSessionFilter.allowed("POST", "/api/v1/documents"));
        assertFalse(SupportSessionFilter.allowed("DELETE", "/api/v1/documents/1"));
        assertFalse(SupportSessionFilter.allowed("PUT", "/api/v1/auth/me"));
        assertFalse(SupportSessionFilter.allowed("GET", "/api/v1/platform/dashboard"));
        assertFalse(SupportSessionFilter.allowed("GET", "/api/v1/support-access"));
        assertFalse(SupportSessionFilter.allowed("GET", "/api/v1/billing/subscription"));
    }

    @Test
    void writesAreRejectedBeforeReachingTheApplication() throws Exception {
        authenticate(session);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(new MockHttpServletRequest("POST", "/api/v1/documents"), response, chain);
        assertEquals(403, response.getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void revokedAccessIsRejectedAndEveryAllowedRequestIsAudited() throws Exception {
        authenticate(session);
        when(support.sessionActive(session)).thenReturn(false);
        MockHttpServletResponse revoked = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(new MockHttpServletRequest("GET", "/api/v1/documents"), revoked, chain);
        assertEquals(401, revoked.getStatus());
        verify(chain, never()).doFilter(any(), any());

        authenticate(session);
        when(support.sessionActive(session)).thenReturn(true);
        filter.doFilter(new MockHttpServletRequest("GET", "/api/v1/documents"), new MockHttpServletResponse(), chain);
        verify(chain).doFilter(any(), any());
        verify(support).recordRequest(eq(session), eq("GET"), eq("/api/v1/documents"), anyInt(), any());
    }

    @Test
    void normalSessionsPassUntouched() throws Exception {
        authenticate(new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "ana", Set.of("document:create")));
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(new MockHttpServletRequest("POST", "/api/v1/documents"), new MockHttpServletResponse(), chain);
        verify(chain).doFilter(any(), any());
        verifyNoInteractions(support);
    }
}
