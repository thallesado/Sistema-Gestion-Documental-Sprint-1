package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.service.HttpAuditRecorder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HttpAuditInterceptorTest {

    @Mock
    private HttpAuditRecorder auditRecorder;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private Authentication authentication;

    @Mock
    private SecurityContext securityContext;

    private HttpAuditInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new HttpAuditInterceptor(auditRecorder);
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    @DisplayName("afterCompletion extrae cabeceras de cliente X-Client-Timestamp y X-Client-Timezone")
    void testExtractsClientHeaders() {
        AuthenticatedUser user = new AuthenticatedUser(UUID.randomUUID(), UUID.randomUUID(), "diego", Set.of("ROLE_USER"));
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(user);

        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/api/v1/documents");
        when(request.getHeader("X-Forwarded-For")).thenReturn("192.168.1.100");
        when(request.getHeader("User-Agent")).thenReturn("Mozilla/5.0");
        when(request.getHeader("X-Client-Timestamp")).thenReturn("2026-10-18T14:00:00Z");
        when(request.getHeader("X-Client-Timezone")).thenReturn("America/La_Paz");
        when(response.getStatus()).thenReturn(201);

        interceptor.afterCompletion(request, response, new Object(), null);

        verify(auditRecorder).record(
                user,
                "POST",
                "/api/v1/documents",
                201,
                "192.168.1.100",
                "Mozilla/5.0",
                "2026-10-18T14:00:00Z",
                "America/La_Paz"
        );
    }
}
