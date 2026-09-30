package com.lta.gestdocum.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Límite de peticiones por IP para el endpoint público GET /api/v1/tenants/public
 * (ventana fija; por defecto 10 peticiones por minuto). Evita el escaneo de la lista de organizaciones.
 *
 * <p>La IP es {@code getRemoteAddr()}. Detrás de un proxy o balanceador de confianza hay que activar
 * {@code server.forward-headers-strategy=native} para que sea la IP real del cliente; no se lee
 * X-Forwarded-For a mano porque cualquier cliente podría falsificarlo.
 */
@Component
public class PublicEndpointRateLimitFilter extends OncePerRequestFilter {

    private static final String PATH = "/api/v1/tenants/public";
    private static final int CLEANUP_THRESHOLD = 10_000;

    private record Window(long startMillis, int count) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final int maxRequests;
    private final long windowMillis;

    public PublicEndpointRateLimitFilter(
            @Value("${app.rate-limit.public-tenants.max-requests:10}") int maxRequests,
            @Value("${app.rate-limit.public-tenants.window-seconds:60}") long windowSeconds) {
        this.maxRequests = maxRequests;
        this.windowMillis = windowSeconds * 1000;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !("GET".equals(request.getMethod()) && PATH.equals(request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        long now = System.currentTimeMillis();
        if (windows.size() > CLEANUP_THRESHOLD) {
            windows.entrySet().removeIf(entry -> now - entry.getValue().startMillis() >= windowMillis);
        }
        Window window = windows.compute(request.getRemoteAddr(), (ip, current) ->
                current == null || now - current.startMillis() >= windowMillis
                        ? new Window(now, 1)
                        : new Window(current.startMillis(), current.count() + 1));
        if (window.count() > maxRequests) {
            long retryAfter = Math.max(1, (window.startMillis() + windowMillis - now + 999) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Demasiadas solicitudes. Intenta nuevamente en unos segundos.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
