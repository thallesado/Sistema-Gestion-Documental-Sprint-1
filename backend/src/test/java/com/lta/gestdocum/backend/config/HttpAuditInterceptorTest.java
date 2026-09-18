package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.service.HttpAuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.UUID;

import static org.mockito.Mockito.*;

class HttpAuditInterceptorTest {
    private final HttpAuditService service = mock(HttpAuditService.class);
    private final HttpAuditInterceptor interceptor = new HttpAuditInterceptor(service);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void recordsAuthenticatedReadWithoutRequestBody() {
        AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(),
                "auditor", Set.of("patient:read"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, java.util.List.of()));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/patients");
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("User-Agent", "test-agent");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(200);

        interceptor.afterCompletion(request, response, new Object(), null);

        verify(service).record(user, "GET", "/api/v1/patients", 200,
                "127.0.0.1", "test-agent");
    }
}
