package com.lta.gestdocum.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class JwtService {
    private final Key key;
    private final long expiration;
    private final long refreshExpiration;
    private final Set<String> revokedTokens = ConcurrentHashMap.newKeySet();

    public JwtService(String secret, long expiration) {
        this(secret, expiration, 604800000L);
    }

    @Autowired
    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long expiration,
            @Value("${jwt.refresh-expiration}") long refreshExpiration) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        this.expiration = expiration;
        this.refreshExpiration = refreshExpiration;
    }

    public String generateToken(UUID userId, UUID tenantId, String username,
                                Collection<String> authorities) {
        if (authorities == null || authorities.isEmpty()) {
            throw new IllegalArgumentException("No se puede emitir un JWT sin authorities");
        }
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("userId", userId.toString());
        if (tenantId != null) {
            claims.put("tenantId", tenantId.toString());
        }
        claims.put("authorities", List.copyOf(authorities));
        claims.put("tokenType", "access");

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(username)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public void revoke(String token) {
        revokedTokens.add(token);
    }

    public boolean isRevoked(String token) {
        return revokedTokens.contains(token);
    }

    public String generateRefreshToken(UUID userId, UUID tenantId, String username) {
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("userId", userId.toString());
        if (tenantId != null) {
            claims.put("tenantId", tenantId.toString());
        }
        claims.put("tokenType", "refresh");
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + refreshExpiration))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isRefreshToken(String token) {
        return "refresh".equals(parse(token).get("tokenType", String.class));
    }

    public RefreshIdentity extractRefreshIdentity(String token) {
        if (isRevoked(token)) {
            throw new MalformedJwtException("El refresh token fue revocado");
        }
        Claims claims = parse(token);
        if (!"refresh".equals(claims.get("tokenType", String.class))) {
            throw new MalformedJwtException("El token no es de renovación");
        }
        return new RefreshIdentity(
                parseRequiredUuid(claims, "userId"),
                parseOptionalUuid(claims, "tenantId"),
                claims.getSubject());
    }

    public long getExpiration() {
        return expiration;
    }

    public long getRefreshExpiration() {
        return refreshExpiration;
    }

    public record RefreshIdentity(UUID userId, UUID tenantId, String username) {}

    /**
     * Compatibilidad para emisores antiguos: el rol no concede ningún permiso
     * de módulo; solo evita volver a generar tokens con authorities vacías.
     */
    public String generateToken(UUID userId, UUID tenantId, String username, String role) {
        return generateToken(userId, tenantId, username, Set.of("ROLE_" + role));
    }

    public AuthenticatedUser extractAuthenticatedUser(String token) {
        Claims claims = parse(token);
        String username = claims.getSubject();
        UUID userId = parseRequiredUuid(claims, "userId");
        UUID tenantId = parseOptionalUuid(claims, "tenantId");
        List<?> rawAuthorities = claims.get("authorities", List.class);
        if (rawAuthorities == null || rawAuthorities.isEmpty()) {
            throw new MalformedJwtException("El JWT no contiene authorities");
        }
        Set<String> authorities = rawAuthorities.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .filter(value -> !value.isBlank())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        return new AuthenticatedUser(userId, tenantId, username, authorities);
    }

    public String extractUsername(String token) {
        return parse(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            extractAuthenticatedUser(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parse(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private UUID parseRequiredUuid(Claims claims, String name) {
        String value = claims.get(name, String.class);
        if (value == null || value.isBlank()) {
            throw new MalformedJwtException("Falta el claim " + name);
        }
        return UUID.fromString(value);
    }

    private UUID parseOptionalUuid(Claims claims, String name) {
        String value = claims.get(name, String.class);
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }
}
