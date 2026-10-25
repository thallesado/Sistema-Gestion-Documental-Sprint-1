package com.lta.gestdocum.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.service.AuthenticationAuditService;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Clock;

/** Fixed-window login throttling by source address and normalized account identifier. */
@Component
public class LoginAttemptRateLimitFilter extends OncePerRequestFilter {
    private static final String LOGIN_PATH = "/api/v1/auth/login";
    private static final int MAX_BODY_BYTES = 64 * 1024;
    private static final int MAX_BUCKETS = 100_000;
    private record Window(long start, int count) { }
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final ObjectMapper mapper;
    private final AuthenticationAuditService audit;
    private final int maxAttempts;
    private final long windowMillis;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public LoginAttemptRateLimitFilter(ObjectMapper mapper, AuthenticationAuditService audit,
            @Value("${app.rate-limit.login.max-attempts:5}") int maxAttempts,
            @Value("${app.rate-limit.login.window-seconds:60}") long windowSeconds) {
        this(mapper, audit, maxAttempts, windowSeconds, Clock.systemUTC());
    }

    LoginAttemptRateLimitFilter(ObjectMapper mapper, AuthenticationAuditService audit,
                               int maxAttempts, long windowSeconds, Clock clock) {
        this.mapper = mapper;
        this.audit = audit;
        this.clock = clock;
        if (maxAttempts < 1 || windowSeconds < 1) throw new IllegalArgumentException("Límite de login inválido");
        this.maxAttempts = maxAttempts;
        this.windowMillis = Math.multiplyExact(windowSeconds, 1000L);
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !("POST".equals(request.getMethod()) && LOGIN_PATH.equals(request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            return;
        }
        byte[] body = readBounded(request.getInputStream());
        if (body == null) {
            response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            return;
        }
        CachedBodyRequest wrapped = new CachedBodyRequest(request, body);
        String identifier = readIdentifier(body);
        long now = clock.millis();
        if (windows.size() > MAX_BUCKETS) windows.entrySet().removeIf(e -> now - e.getValue().start() >= windowMillis);

        Take ip = take("ip:" + request.getRemoteAddr(), now);
        Take user = identifier.isBlank() ? null
                : take("user:" + readScope(body) + ":" + identifier.toLowerCase(java.util.Locale.ROOT), now);
        long retryAfter = Math.max(ip.retryAfter(), user == null ? 0 : user.retryAfter());
        if (retryAfter > 0) {
            audit.recordFailedAuthentication(identifier, null, request);
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(retryAfter));
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Demasiados intentos de inicio de sesión. Espera antes de volver a intentar.\"}");
            return;
        }
        chain.doFilter(wrapped, response);
        // Solo los intentos fallidos consumen el cupo: se reserva antes de procesar (las peticiones
        // en paralelo no lo exceden) y se devuelve si el login fue correcto.
        if (response.getStatus() < 400) {
            refund(ip);
            refund(user);
        }
    }

    private record Take(String key, long windowStart, long retryAfter) { }

    private synchronized void refund(Take take) {
        if (take == null || take.key() == null) return;
        windows.computeIfPresent(take.key(), (ignored, current) ->
                current.start() == take.windowStart() && current.count() > 0
                        ? new Window(current.start(), current.count() - 1) : current);
    }

    private synchronized Take take(String key, long now) {
        String hashed = digest(key);
        if (!windows.containsKey(hashed) && windows.size() >= MAX_BUCKETS) {
            windows.entrySet().removeIf(e -> now - e.getValue().start() >= windowMillis);
            if (windows.size() >= MAX_BUCKETS) return new Take(null, 0, Math.max(1, windowMillis / 1000));
        }
        Window updated = windows.compute(hashed, (ignored, current) -> current == null || now - current.start() >= windowMillis
                ? new Window(now, 1) : new Window(current.start(), Math.min(maxAttempts, current.count()) + 1));
        if (updated.count() <= maxAttempts) return new Take(hashed, updated.start(), 0);
        return new Take(hashed, updated.start(), Math.max(1, (updated.start() + windowMillis - now + 999) / 1000));
    }

    private String readScope(byte[] body) {
        try {
            var json = mapper.readTree(body);
            String id = json.path("tenantId").asText("").trim();
            String name = json.path("tenantName").asText("").trim().toLowerCase(java.util.Locale.ROOT);
            return !id.isBlank() ? id.toLowerCase(java.util.Locale.ROOT) : name;
        } catch (Exception ignored) { return ""; }
    }

    private String readIdentifier(byte[] body) {
        try {
            String value = mapper.readTree(body).path("usernameOrEmail").asText("").trim();
            return value.length() > 150 ? value.substring(0, 150) : value;
        } catch (Exception ignored) { return ""; }
    }

    private static byte[] readBounded(InputStream input) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096]; int count;
        while ((count = input.read(buffer)) != -1) {
            if (out.size() + count > MAX_BODY_BYTES) return null;
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }

    private static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException("SHA-256 no disponible", e); }
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        CachedBodyRequest(HttpServletRequest request, byte[] body) { super(request); this.body = body; }
        @Override public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public int read() { return input.read(); }
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) { throw new IllegalStateException("Lectura async no soportada"); }
            };
        }
        @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(), getCharacterEncoding() == null ? StandardCharsets.UTF_8 : java.nio.charset.Charset.forName(getCharacterEncoding()))); }
        @Override public int getContentLength() { return body.length; }
        @Override public long getContentLengthLong() { return body.length; }
    }
}
