package com.lta.gestdocum.backend.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class MustChangePasswordFilterTest {

    private final MustChangePasswordFilter filter = new MustChangePasswordFilter();

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void authenticate(boolean mustChange) {
        Set<String> authorities = mustChange
                ? Set.of("document:read", MustChangePasswordFilter.MARKER_AUTHORITY)
                : Set.of("document:read");
        AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "admin", authorities);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null,
                authorities.stream().map(SimpleGrantedAuthority::new).toList()));
    }

    private MockHttpServletResponse invoke(String method, String path, boolean[] reached) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest(method, path), response, (req, res) -> {
            reached[0] = true;
            ((jakarta.servlet.http.HttpServletResponse) res).setStatus(200);
        });
        return response;
    }

    @Test
    void flaggedUserIsRejectedWith403AndMustChangeCode() throws Exception {
        authenticate(true);
        for (String[] call : new String[][] {{"GET", "/api/v1/users"}, {"GET", "/api/v1/documents"},
                {"PUT", "/api/v1/auth/me"}, {"POST", "/api/v1/users"}}) {
            boolean[] reached = {false};
            MockHttpServletResponse response = invoke(call[0], call[1], reached);
            assertEquals(403, response.getStatus(), call[1]);
            assertFalse(reached[0], call[1]);
            assertTrue(response.getContentAsString().contains("\"code\":\"MUST_CHANGE_PASSWORD\""));
        }
    }

    @Test
    void flaggedUserKeepsAccessToPasswordChangeMeLogoutAndRefresh() throws Exception {
        authenticate(true);
        for (String[] call : new String[][] {{"GET", "/api/v1/auth/me"}, {"POST", "/api/v1/auth/logout"},
                {"POST", "/api/v1/auth/refresh"}, {"PUT", "/api/v1/auth/me/password"}}) {
            boolean[] reached = {false};
            assertEquals(200, invoke(call[0], call[1], reached).getStatus(), call[1]);
            assertTrue(reached[0], call[1]);
        }
    }

    @Test
    void unflaggedUserAndAnonymousRequestsPassUntouched() throws Exception {
        authenticate(false);
        boolean[] reached = {false};
        assertEquals(200, invoke("GET", "/api/v1/users", reached).getStatus());
        assertTrue(reached[0]);
        SecurityContextHolder.clearContext();
        reached[0] = false;
        assertEquals(200, invoke("GET", "/api/v1/users", reached).getStatus());
        assertTrue(reached[0]);
    }
}
