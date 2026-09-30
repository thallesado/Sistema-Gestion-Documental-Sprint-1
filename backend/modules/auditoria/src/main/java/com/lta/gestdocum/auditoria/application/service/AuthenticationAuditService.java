package com.lta.gestdocum.auditoria.application.service;

import com.lta.gestdocum.autenticacion.application.dto.AuthResponse;
import com.lta.gestdocum.autenticacion.domain.repository.AuthenticationAuditPort;
import com.lta.gestdocum.shared.security.AuthenticatedUser;
import com.lta.gestdocum.autenticacion.infrastructure.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AuthenticationAuditService implements AuthenticationAuditPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(AuthenticationAuditService.class);

    private final JwtService jwtService;
    private final HttpAuditRecorder auditRecorder;

    public AuthenticationAuditService(JwtService jwtService, HttpAuditRecorder auditRecorder) {
        this.jwtService = jwtService;
        this.auditRecorder = auditRecorder;
    }

    @Override
    public void recordSuccessfulAuthentication(AuthResponse response, HttpServletRequest request) {
        try {
            AuthenticatedUser user = jwtService.extractAuthenticatedUser(response.getToken());
            String forwarded = request.getHeader("X-Forwarded-For");
            auditRecorder.record(user, request.getMethod(), request.getRequestURI(), 200,
                    forwarded == null ? request.getRemoteAddr() : forwarded,
                    request.getHeader("User-Agent"));
        } catch (RuntimeException exception) {
            LOGGER.warn("No se pudo persistir la auditoría de autenticación method={} path={} failure={}",
                    request.getMethod(), request.getRequestURI(), exception.getClass().getSimpleName());
        }
    }
}
