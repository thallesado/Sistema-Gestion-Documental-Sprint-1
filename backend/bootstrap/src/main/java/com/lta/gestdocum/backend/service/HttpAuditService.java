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
        if (user.tenantId() == null) return;
        userContext.establishDatabaseContext(user);
        String[] segments = path.split("/");
        String entityType = segments.length > 3 && !segments[3].isBlank()
                ? segments[3].toUpperCase() : "API";
        UUID entityId = firstUuid(segments);
        String details = json(Map.of("method", method, "path", path, "status", status));
        entityManager.createNativeQuery("""
                select app.record_http_access(
                  cast(:action as text), cast(:entityType as text), cast(:entityId as uuid),
                  cast(:result as text), cast(:ip as inet), cast(:userAgent as text),
                  cast(:details as jsonb))
                """)
                .setParameter("action", "HTTP_" + method)
                .setParameter("entityType", entityType)
                .setParameter("entityId", entityId)
                .setParameter("result", status < 400 ? "SUCCESS" : "FAILURE")
                .setParameter("ip", normalizeIp(ipAddress))
                .setParameter("userAgent", userAgent == null ? "" : userAgent)
                .setParameter("details", details)
                .getSingleResult();
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
