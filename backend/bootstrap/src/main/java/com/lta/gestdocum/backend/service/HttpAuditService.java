package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class HttpAuditService implements HttpAuditRecorder {
    private final EntityManager entityManager;
    private final AuthenticatedUserContext userContext;
    private final ObjectMapper objectMapper;

    public HttpAuditService(EntityManager entityManager, AuthenticatedUserContext userContext,
                            ObjectMapper objectMapper) {
        this.entityManager = entityManager;
        this.userContext = userContext;
        this.objectMapper = objectMapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Override
    public void record(AuthenticatedUser user, String method, String path, int status,
                       String ipAddress, String userAgent) {
        record(user, method, path, status, ipAddress, userAgent, null, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Override
    public void record(AuthenticatedUser user, String method, String path, int status,
                       String ipAddress, String userAgent, String clientTimestamp, String clientTimezone) {
        String[] segments = path.split("/");
        String entityType = segments.length > 3 && !segments[3].isBlank()
                ? segments[3].toUpperCase() : "API";
        UUID entityId = firstUuid(segments);
        String details = json(Map.of("method", method, "path", path, "status", status));
        String result = status < 400 ? "SUCCESS" : "FAILURE";
        String ip = normalizeIp(ipAddress);
        String agent = userAgent == null ? "" : userAgent;
        java.time.OffsetDateTime parsedClientTs = parseClientTimestamp(clientTimestamp);
        String clientTz = (clientTimezone != null && !clientTimezone.isBlank()) ? clientTimezone.trim() : null;

        if (user.tenantId() != null) {
            userContext.establishDatabaseContext(user);
            entityManager.createNativeQuery("""
                    select app.record_http_access(
                      cast(:action as text), cast(:entityType as text), cast(:entityId as uuid),
                      cast(:result as text), cast(:ip as inet), cast(:userAgent as text),
                      cast(:details as jsonb), cast(:clientTimestamp as timestamptz), cast(:clientTimezone as text))
                    """)
                    .setParameter("action", "HTTP_" + method)
                    .setParameter("entityType", entityType)
                    .setParameter("entityId", entityId)
                    .setParameter("result", result)
                    .setParameter("ip", ip)
                    .setParameter("userAgent", agent)
                    .setParameter("details", details)
                    .setParameter("clientTimestamp", parsedClientTs)
                    .setParameter("clientTimezone", clientTz)
                    .getSingleResult();
            return;
        }
        entityManager.createNativeQuery("""
                insert into audit_events(platform_actor_id, action, entity_type, entity_id,
                  result, ip_address, user_agent, details, client_timestamp, client_timezone)
                values (:actorId, cast(:action as text), cast(:entityType as text), cast(:entityId as uuid),
                  cast(:result as text), cast(:ip as inet), cast(:userAgent as text), cast(:details as jsonb),
                  cast(:clientTimestamp as timestamptz), cast(:clientTimezone as text))
                """)
                .setParameter("actorId", user.userId())
                .setParameter("action", "HTTP_" + method)
                .setParameter("entityType", entityType)
                .setParameter("entityId", entityId)
                .setParameter("result", result)
                .setParameter("ip", ip)
                .setParameter("userAgent", agent)
                .setParameter("details", details)
                .setParameter("clientTimestamp", parsedClientTs)
                .setParameter("clientTimezone", clientTz)
                .executeUpdate();
    }

    private UUID firstUuid(String[] segments) {
        for (String segment : segments) {
            try { return UUID.fromString(segment); }
            catch (IllegalArgumentException ignored) { }
        }
        return null;
    }

    private String normalizeIp(String value) {
        if (value == null || value.isBlank()) return "0.0.0.0";
        int comma = value.indexOf(',');
        return (comma < 0 ? value : value.substring(0, comma)).trim();
    }

    private String json(Map<String, Object> details) {
        try { return objectMapper.writeValueAsString(details); }
        catch (JsonProcessingException exception) { return "{}"; }
    }

    private java.time.OffsetDateTime parseClientTimestamp(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return java.time.OffsetDateTime.parse(raw.trim());
        } catch (Exception ignored) {
            try {
                return java.time.Instant.parse(raw.trim()).atOffset(java.time.ZoneOffset.UTC);
            } catch (Exception e) {
                return null;
            }
        }
    }
}
