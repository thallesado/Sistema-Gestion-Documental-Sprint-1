package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.JwtService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AuthenticationAuditService {
    private static final Logger LOGGER = LoggerFactory.getLogger(AuthenticationAuditService.class);

    private final JwtService jwtService;
    private final HttpAuditRecorder auditRecorder;
    private final JdbcTemplate jdbc;

    public AuthenticationAuditService(JwtService jwtService, HttpAuditRecorder auditRecorder, JdbcTemplate jdbc) {
        this.jwtService = jwtService;
        this.auditRecorder = auditRecorder;
        this.jdbc = jdbc;
    }

    public void recordSuccessfulAuthentication(AuthResponse response, HttpServletRequest request) {
        try {
            AuthenticatedUser user = jwtService.extractAuthenticatedUser(response.getToken());
            auditRecorder.record(user, request.getMethod(), request.getRequestURI(), 200,
                    request.getRemoteAddr(),
                    request.getHeader("User-Agent"));
        } catch (RuntimeException exception) {
            LOGGER.warn("No se pudo persistir la auditoría de autenticación method={} path={} failure={}",
                    request.getMethod(), request.getRequestURI(), exception.getClass().getSimpleName());
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailedAuthentication(String attemptedIdentifier, String attemptedTenantId,
                                           HttpServletRequest request) {
        try {
            String identifier = attemptedIdentifier == null ? "" : attemptedIdentifier.trim();
            if (identifier.length() > 150) identifier = identifier.substring(0, 150);
            String forwarded = request.getRemoteAddr();
            String agent = request.getHeader("User-Agent");
            jdbc.execute("SET LOCAL ROLE nexodocs_app");
            jdbc.queryForObject("SELECT app.record_failed_authentication(?::uuid, ?, ?::inet, ?)",
                    Object.class, attemptedTenantId, identifier, forwarded,
                    agent == null ? "" : agent.substring(0, Math.min(agent.length(), 1000)));
        } catch (RuntimeException exception) {
            LOGGER.warn("No se pudo persistir el fallo de autenticación failure={}",
                    exception.getClass().getSimpleName());
        }
    }
}
