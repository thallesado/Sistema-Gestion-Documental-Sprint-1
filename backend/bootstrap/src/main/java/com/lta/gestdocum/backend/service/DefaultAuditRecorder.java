package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class DefaultAuditRecorder implements AuditRecorder {

    private static final Logger log = LoggerFactory.getLogger(DefaultAuditRecorder.class);
    private static final int MAX_STRING_LENGTH = 300;
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "password", "passwordhash", "token", "secret", "apikey", "key",
            "refreshtoken", "accesstoken", "credential", "pin", "authorization");

    private final EntityManager entityManager;
    private final AuthenticatedUserContext userContext;
    private final ObjectMapper objectMapper;

    public DefaultAuditRecorder(EntityManager entityManager,
                                AuthenticatedUserContext userContext,
                                ObjectMapper objectMapper) {
        this.entityManager = entityManager;
        this.userContext = userContext;
        this.objectMapper = objectMapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Override
    public void record(String action, String entityType, UUID entityId,
                       Map<String, Object> before, Map<String, Object> after) {
        try {
            AuthenticatedUser user = resolveUser();
            if (user == null) {
                log.debug("No se pudo auditar {} {}: usuario no autenticado", action, entityType);
                return;
            }

            Map<String, Object> sanitizedBefore = sanitizeMap(before);
            Map<String, Object> sanitizedAfter = sanitizeMap(after);

            Map<String, Object> detailsMap = new LinkedHashMap<>();
            if (sanitizedBefore != null && !sanitizedBefore.isEmpty()) {
                detailsMap.put("before", sanitizedBefore);
            }
            if (sanitizedAfter != null && !sanitizedAfter.isEmpty()) {
                detailsMap.put("after", sanitizedAfter);
            }

            String detailsJson = toJson(detailsMap);
            String ipAddress = "0.0.0.0";
            String userAgent = "";
            OffsetDateTime clientTimestamp = null;
            String clientTimezone = null;

            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes servletAttrs) {
                HttpServletRequest req = servletAttrs.getRequest();
                String forwarded = req.getHeader("X-Forwarded-For");
                ipAddress = normalizeIp(forwarded != null ? forwarded : req.getRemoteAddr());
                userAgent = req.getHeader("User-Agent") != null ? req.getHeader("User-Agent") : "";
                clientTimestamp = parseClientTimestamp(req.getHeader("X-Client-Timestamp"));
                clientTimezone = req.getHeader("X-Client-Timezone");
                if (clientTimezone != null && clientTimezone.isBlank()) clientTimezone = null;
            }

            if (user.tenantId() != null) {
                userContext.establishDatabaseContext(user);
                entityManager.createNativeQuery("""
                        select app.record_http_access(
                          cast(:action as text), cast(:entityType as text), cast(:entityId as uuid),
                          cast(:result as text), cast(:ip as inet), cast(:userAgent as text),
                          cast(:details as jsonb), cast(:clientTimestamp as timestamptz), cast(:clientTimezone as text))
                        """)
                        .setParameter("action", action != null ? action.trim().toUpperCase() : "MUTATE")
                        .setParameter("entityType", entityType != null ? entityType.trim().toUpperCase() : "RESOURCE")
                        .setParameter("entityId", entityId)
                        .setParameter("result", "SUCCESS")
                        .setParameter("ip", ipAddress)
                        .setParameter("userAgent", userAgent)
                        .setParameter("details", detailsJson)
                        .setParameter("clientTimestamp", clientTimestamp)
                        .setParameter("clientTimezone", clientTimezone)
                        .getSingleResult();
            } else {
                entityManager.createNativeQuery("""
                        insert into audit_events(platform_actor_id, action, entity_type, entity_id,
                          result, ip_address, user_agent, details, client_timestamp, client_timezone)
                        values (:actorId, cast(:action as text), cast(:entityType as text), cast(:entityId as uuid),
                          cast(:result as text), cast(:ip as inet), cast(:userAgent as text), cast(:details as jsonb),
                          cast(:clientTimestamp as timestamptz), cast(:clientTimezone as text))
                        """)
                        .setParameter("actorId", user.userId())
                        .setParameter("action", action != null ? action.trim().toUpperCase() : "MUTATE")
                        .setParameter("entityType", entityType != null ? entityType.trim().toUpperCase() : "RESOURCE")
                        .setParameter("entityId", entityId)
                        .setParameter("result", "SUCCESS")
                        .setParameter("ip", ipAddress)
                        .setParameter("userAgent", userAgent)
                        .setParameter("details", detailsJson)
                        .setParameter("clientTimestamp", clientTimestamp)
                        .setParameter("clientTimezone", clientTimezone)
                        .executeUpdate();
            }
        } catch (Exception e) {
            log.warn("Error al registrar auditoría detallada action={} entityType={} id={}: {}",
                    action, entityType, entityId, e.getMessage());
        }
    }

    private AuthenticatedUser resolveUser() {
        try {
            return userContext.require();
        } catch (Exception ignored) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser u) {
                return u;
            }
            return null;
        }
    }

    public Map<String, Object> sanitizeMap(Map<String, Object> input) {
        if (input == null) return null;
        Map<String, Object> sanitized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : input.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (isSensitive(key)) {
                sanitized.put(key, "[PROTECTED]");
            } else if (value instanceof String s) {
                if (s.length() > MAX_STRING_LENGTH) {
                    sanitized.put(key, s.substring(0, MAX_STRING_LENGTH) + "... [TRUNCATED]");
                } else {
                    sanitized.put(key, s);
                }
            } else if (value instanceof Map<?, ?> m) {
                @SuppressWarnings("unchecked")
                Map<String, Object> typedMap = (Map<String, Object>) m;
                sanitized.put(key, sanitizeMap(typedMap));
            } else {
                sanitized.put(key, value);
            }
        }
        return sanitized;
    }

    public boolean isSensitive(String key) {
        if (key == null) return false;
        String normalized = key.toLowerCase(Locale.ROOT).replaceAll("[_-]", "");
        for (String sensitive : SENSITIVE_KEYS) {
            if (normalized.contains(sensitive)) return true;
        }
        return false;
    }

    private String toJson(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private String normalizeIp(String value) {
        if (value == null || value.isBlank()) return "0.0.0.0";
        int comma = value.indexOf(',');
        return (comma < 0 ? value : value.substring(0, comma)).trim();
    }

    private OffsetDateTime parseClientTimestamp(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return OffsetDateTime.parse(raw.trim());
        } catch (Exception ignored) {
            try {
                return java.time.Instant.parse(raw.trim()).atOffset(java.time.ZoneOffset.UTC);
            } catch (Exception e) {
                return null;
            }
        }
    }
}
