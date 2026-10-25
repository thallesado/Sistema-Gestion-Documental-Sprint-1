package com.lta.gestdocum.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Bloquea el uso normal de la API a quien debe cambiar su contraseña temporal. AuthService marca el
 * JWT con {@link #MARKER_AUTHORITY} mientras users.must_change_password sea true. Solo se permite
 * consultar /auth/me, cambiar la contraseña, renovar la sesión y cerrarla.
 */
@Component
public class MustChangePasswordFilter extends OncePerRequestFilter {

    /** Authority interna (prefijo ROLE_: no se expone como permiso en /auth/me ni en el login). */
    public static final String MARKER_AUTHORITY = "ROLE_MUST_CHANGE_PASSWORD";
    public static final String CODE = "MUST_CHANGE_PASSWORD";

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean flagged = auth != null && auth.isAuthenticated() && auth.getAuthorities().stream()
                .anyMatch(a -> MARKER_AUTHORITY.equals(a.getAuthority()));
        if (!flagged || isAllowed(request.getMethod(), request.getRequestURI())) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"status\":403,\"error\":\"Forbidden\",\"code\":\"" + CODE
                + "\",\"message\":\"Debes cambiar tu contraseña temporal antes de continuar\"}");
    }

    private static boolean isAllowed(String method, String path) {
        return "OPTIONS".equals(method)
                || ("GET".equals(method) && "/api/v1/auth/me".equals(path))
                || ("POST".equals(method) && ("/api/v1/auth/logout".equals(path) || "/api/v1/auth/refresh".equals(path)))
                || ("PUT".equals(method) && "/api/v1/auth/me/password".equals(path));
    }
}
