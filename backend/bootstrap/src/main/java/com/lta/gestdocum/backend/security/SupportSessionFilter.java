package com.lta.gestdocum.backend.security;

import com.lta.gestdocum.backend.service.SupportAccessService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

/**
 * Sesión de soporte (066): solo lectura y solo dentro del tenant. Rechaza cualquier método que no sea de
 * lectura (salvo cerrar sesión) y las rutas de plataforma, facturación, respaldos o decisión de accesos;
 * comprueba en cada petición que el acceso siga vigente (el tenant puede revocarlo) y deja cada petición
 * en la auditoría del tenant. La base repite la regla: sin transacción de solo lectura no reconoce la sesión.
 */
@Component
public class SupportSessionFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(SupportSessionFilter.class);
    private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final SupportAccessService support;

    public SupportSessionFilter(SupportAccessService support) { this.support = support; }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user) || !user.supportSession()) {
            chain.doFilter(request, response);
            return;
        }
        String path = request.getRequestURI();
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        if (!allowed(method, path)) {
            reject(response, 403, "La sesión de soporte es de solo lectura");
            return;
        }
        if (!support.sessionActive(user)) {
            SecurityContextHolder.clearContext();
            reject(response, 401, "El acceso de soporte venció o fue revocado");
            return;
        }
        try {
            chain.doFilter(request, response);
        } finally {
            if (path.startsWith("/api/") && !"OPTIONS".equals(method)) {
                try {
                    support.recordRequest(user, method, path, response.getStatus(), request.getRemoteAddr());
                } catch (RuntimeException exception) {
                    log.warn("No se pudo auditar la petición de soporte {} {}: {}", method, path, exception.getClass().getSimpleName());
                }
            }
        }
    }

    static boolean allowed(String method, String path) {
        if ("POST".equals(method) && "/api/v1/auth/logout".equals(path)) return true;
        if (!READ_METHODS.contains(method)) return false;
        return !path.startsWith("/api/v1/platform") && !path.startsWith("/api/v1/support-access")
                && !path.startsWith("/api/v1/billing") && !path.startsWith("/api/v1/backups");
    }

    private static void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"status\":" + status + ",\"message\":\"" + message + "\"}");
    }
}
