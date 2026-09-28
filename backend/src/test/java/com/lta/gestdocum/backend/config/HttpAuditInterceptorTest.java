package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.service.HttpAuditRecorder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

class HttpAuditInterceptorTest {
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void recordsAuthenticatedReadWithoutRequestBody() {
        RecordingAuditRecorder recorder = new RecordingAuditRecorder();
        HttpAuditInterceptor interceptor = new HttpAuditInterceptor(recorder);
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

        assertEquals(user, recorder.user);
        assertEquals("GET", recorder.method);
        assertEquals("/api/v1/patients", recorder.path);
        assertEquals(200, recorder.status);
        assertEquals("127.0.0.1", recorder.ipAddress);
        assertEquals("test-agent", recorder.userAgent);
    }

    @Test
    void doesNotReplaceBusinessResponseWhenAuditPersistenceFails() {
        HttpAuditInterceptor interceptor = new HttpAuditInterceptor(
                (user, method, path, status, ipAddress, userAgent) -> {
                    throw new IllegalStateException("connection failed");
                });
        AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(),
                "auditor", Set.of("patient:read"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, java.util.List.of()));

        assertDoesNotThrow(() -> interceptor.afterCompletion(
                new MockHttpServletRequest("GET", "/api/v1/patients"),
                new MockHttpServletResponse(), new Object(), null));
    }

    private static final class RecordingAuditRecorder implements HttpAuditRecorder {
        private AuthenticatedUser user;
        private String method;
        private String path;
        private int status;
        private String ipAddress;
        private String userAgent;

        @Override
        public void record(AuthenticatedUser user, String method, String path, int status,
                           String ipAddress, String userAgent) {
            this.user = user;
            this.method = method;
            this.path = path;
            this.status = status;
            this.ipAddress = ipAddress;
            this.userAgent = userAgent;
        }
    }
}
