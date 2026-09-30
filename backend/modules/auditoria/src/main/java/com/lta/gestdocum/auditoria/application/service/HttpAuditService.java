package com.lta.gestdocum.auditoria.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.shared.security.AuthenticatedUser;
import com.lta.gestdocum.shared.security.AuthenticatedUserContext;
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
        String[] segments = path.split("/");
        String entityType = segments.length > 3 && !segments[3].isBlank()
                ? segments[3].toUpperCase() : "API";
        UUID entityId = firstUuid(segments);
        String details = json(Map.of("method", method, "path", path, "status", status));
        String result = status < 400 ? "SUCCESS" : "FAILURE";
        String ip = normalizeIp(ipAddress);
        String agent = userAgent == null ? "" : userAgent;
        if (user.tenantId() != null) {
            userContext.establishDatabaseContext(user);
            entityManager.createNativeQuery("""
                    select app.record_http_access(
                      cast(:action as text), cast(:entityType as text), cast(:entityId as uuid),
                      cast(:result as text), cast(:ip as inet), cast(:userAgent as text),
                      cast(:details as jsonb))
                    """)
                    .setParameter("action", "HTTP_" + method)
                    .setParameter("entityType", entityType)
                    .setParameter("entityId", entityId)
                    .setParameter("result", result)
                    .setParameter("ip", ip)
                    .setParameter("userAgent", agent)
                    .setParameter("details", details)
                    .getSingleResult();
            return;
        }
        entityManager.createNativeQuery("""
                insert into audit_events(platform_actor_id, action, entity_type, entity_id,
                  result, ip_address, user_agent, details)
                values (:actorId, cast(:action as text), cast(:entityType as text), cast(:entityId as uuid),
                  cast(:result as text), cast(:ip as inet), cast(:userAgent as text), cast(:details as jsonb))
                """)
                .setParameter("actorId", user.userId())
                .setParameter("action", "HTTP_" + method)
                .setParameter("entityType", entityType)
                .setParameter("entityId", entityId)
                .setParameter("result", result)
                .setParameter("ip", ip)
                .setParameter("userAgent", agent)
                .setParameter("details", details)
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
}
