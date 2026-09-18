package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.service.HttpAuditRecorder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class HttpAuditInterceptor implements HandlerInterceptor {
    private static final Logger LOGGER = LoggerFactory.getLogger(HttpAuditInterceptor.class);
    private final HttpAuditRecorder auditService;

    public HttpAuditInterceptor(HttpAuditRecorder auditService) {
        this.auditService = auditService;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception exception) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) return;
        try {
            String forwarded = request.getHeader("X-Forwarded-For");
            auditService.record(user, request.getMethod(), request.getRequestURI(), response.getStatus(),
                    forwarded == null ? request.getRemoteAddr() : forwarded,
                    request.getHeader("User-Agent"));
        } catch (RuntimeException auditException) {
            LOGGER.warn("No se pudo persistir la auditoría HTTP method={} path={} status={} failure={}",
                    request.getMethod(), request.getRequestURI(), response.getStatus(),
                    auditException.getClass().getSimpleName());
        }
    }
}
