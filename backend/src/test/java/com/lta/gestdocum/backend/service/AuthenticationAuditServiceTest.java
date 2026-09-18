package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

class AuthenticationAuditServiceTest {
    private final JwtService jwtService = new JwtService("01234567890123456789012345678901", 3_600_000);

    @Test
    void capturesLoginAccessMetadataFromTheIssuedAccessToken() {
        AuthenticatedUser identity = identity();
        AuthResponse response = responseFor(identity);
        RecordingAuditRecorder recorder = new RecordingAuditRecorder();
        AuthenticationAuditService service = new AuthenticationAuditService(jwtService, recorder);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr("203.0.113.11");
        request.addHeader("User-Agent", "NexoDocs Test");

        service.recordSuccessfulAuthentication(response, request);

        assertEquals(identity.userId(), recorder.user.userId());
        assertEquals("POST", recorder.method);
        assertEquals("/api/v1/auth/login", recorder.path);
        assertEquals(200, recorder.status);
        assertEquals("203.0.113.11", recorder.ipAddress);
        assertEquals("NexoDocs Test", recorder.userAgent);
    }

    @Test
    void suppressesPersistenceFailureWithoutExposingTheAccessToken() {
        AuthenticationAuditService service = new AuthenticationAuditService(jwtService,
                (user, method, path, status, ipAddress, userAgent) -> {
                    throw new IllegalStateException("connection failed");
                });
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/refresh");

        assertDoesNotThrow(() -> service.recordSuccessfulAuthentication(responseFor(identity()), request));
    }

    private AuthenticatedUser identity() {
        return new AuthenticatedUser(
                UUID.randomUUID(), UUID.randomUUID(), "auditor", Set.of("audit:read_tenant"));
    }

    private AuthResponse responseFor(AuthenticatedUser identity) {
        return new AuthResponse(jwtService.generateToken(
                identity.userId(), identity.tenantId(), identity.username(), identity.authorities()),
                "Bearer", "not-used-by-audit", 3_600_000);
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
