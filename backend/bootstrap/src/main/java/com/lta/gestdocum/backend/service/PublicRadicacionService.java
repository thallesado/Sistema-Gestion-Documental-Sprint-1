package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.PublicRadicacionResponse;
import com.lta.gestdocum.backend.dto.PublicRadicacionResponse.PublicRadicacionEvent;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class PublicRadicacionService {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper objectMapper;

    public PublicRadicacionService(
            ObjectProvider<JdbcTemplate> jdbcProvider,
            PlatformTransactionManager transactionManager,
            ObjectMapper objectMapper) {
        this.jdbc = jdbcProvider.getIfAvailable();
        this.transactions = new TransactionTemplate(transactionManager);
        this.objectMapper = objectMapper;
    }

    public PublicRadicacionResponse consultarRadicacion(UUID tenantId, String code) {
        if (tenantId == null) {
            throw new IllegalArgumentException("El identificador de la organización es obligatorio");
        }
        if (code == null || code.trim().isBlank()) {
            throw new IllegalArgumentException("El código de radicación es obligatorio");
        }

        TenantDatabaseContext.Scope scope = TenantDatabaseContext.useTenant(tenantId);
        try (scope) {
            return transactions.execute(status -> {
                if (jdbc == null) {
                    throw new IllegalStateException("Base de datos no disponible");
                }

                // 1. Validar existencia de la organización
                List<String> tenantNames = jdbc.query(
                        "SELECT name FROM tenants WHERE id = ? AND deleted_at IS NULL",
                        (rs, rowNum) -> rs.getString("name"),
                        tenantId);
                if (tenantNames.isEmpty()) {
                    // Mismo mensaje que un código inexistente: no revela qué organizaciones existen.
                    throw new NotFoundException(notFoundMessage(code.trim().toUpperCase()));
                }
                String tenantName = tenantNames.get(0);

                // 2. Establecer tenant en la sesión para satisfacer RLS
                jdbc.execute("SELECT set_config('app.tenant_id', '" + tenantId + "', true)");

                // 3. Consultar expediente por código
                String normalizedCode = code.trim().toUpperCase();
                String sql = "SELECT id, code, name, status, metadata, created_at, closed_at, archived_at " +
                        "FROM expedients WHERE tenant_id = ? AND upper(trim(code)) = ? AND deleted_at IS NULL";

                List<Map<String, Object>> rows = jdbc.query(sql, (rs, rowNum) -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getObject("id", UUID.class));
                    map.put("code", rs.getString("code"));
                    map.put("name", rs.getString("name"));
                    map.put("status", rs.getString("status"));
                    map.put("metadata", rs.getString("metadata"));
                    map.put("created_at", rs.getObject("created_at", OffsetDateTime.class));
                    map.put("closed_at", rs.getObject("closed_at", OffsetDateTime.class));
                    map.put("archived_at", rs.getObject("archived_at", OffsetDateTime.class));
                    return map;
                }, tenantId, normalizedCode);

                if (rows.isEmpty()) {
                    throw new NotFoundException(notFoundMessage(normalizedCode));
                }

                Map<String, Object> row = rows.get(0);
                String radCode = (String) row.get("code");
                String subject = (String) row.get("name");
                String rawStatus = (String) row.get("status");
                OffsetDateTime createdAt = (OffsetDateTime) row.get("created_at");
                OffsetDateTime closedAt = (OffsetDateTime) row.get("closed_at");
                OffsetDateTime archivedAt = (OffsetDateTime) row.get("archived_at");

                // Parsear metadatos para solicitante y tipo
                Map<String, Object> metadata = parseMetadata((String) row.get("metadata"));
                // Consulta pública sin autenticación: solo iniciales del solicitante.
                String citizenName = initials(extractCitizenName(metadata));
                String radType = extractRadicacionType(metadata);

                String statusLabel = switch (rawStatus) {
                    case "ACTIVE" -> "En Trámite";
                    case "CLOSED" -> "Resuelto / Finalizado";
                    case "ARCHIVED" -> "Archivado";
                    case "BLOCKED" -> "En Revisión Especial";
                    default -> rawStatus;
                };

                // Calcular hash de integridad del sello de tiempo
                String verificationHash = computeHash(radCode + "|" + tenantId + "|" + (createdAt != null ? createdAt.toInstant() : ""));

                // Cronología de eventos públicos
                List<PublicRadicacionEvent> events = new ArrayList<>();
                events.add(new PublicRadicacionEvent(
                        "Radicación Formal Recibida",
                        "Solicitud formal radicada en ventanilla digital bajo el código " + radCode,
                        createdAt != null ? createdAt : OffsetDateTime.now(ZoneOffset.UTC),
                        "COMPLETED"
                ));

                if (closedAt != null) {
                    events.add(new PublicRadicacionEvent(
                            "Trámite Concluido",
                            "La entidad ha emitido respuesta oficial y cerrado el expediente.",
                            closedAt,
                            "COMPLETED"
                    ));
                } else if (archivedAt != null) {
                    events.add(new PublicRadicacionEvent(
                            "Expediente Archivado",
                            "Trámite archivado según tablas de retención documental.",
                            archivedAt,
                            "COMPLETED"
                    ));
                } else {
                    events.add(new PublicRadicacionEvent(
                            "En Gestión por Dependencia Competente",
                            "El requerimiento se encuentra en análisis y elaboración de respuesta dentro de los términos legales.",
                            createdAt != null ? createdAt.plusHours(1) : OffsetDateTime.now(ZoneOffset.UTC),
                            "IN_PROGRESS"
                    ));
                }

                return new PublicRadicacionResponse(
                        radCode,
                        tenantId,
                        tenantName,
                        subject,
                        radType,
                        rawStatus,
                        statusLabel,
                        citizenName,
                        createdAt,
                        verificationHash,
                        // La descripción es interna: no se expone en la consulta pública.
                        null,
                        events
                );
            });
        }
    }

    private static String notFoundMessage(String code) {
        return "No se encontró ningún trámite con el código de radicación " + code;
    }

    /** "Carlos Mendoza" → "C. M."; el valor genérico se conserva tal cual. */
    static String initials(String fullName) {
        if (fullName == null || fullName.isBlank() || "Ciudadano Solicitante".equals(fullName)) return fullName;
        StringBuilder out = new StringBuilder();
        for (String part : fullName.trim().split("\\s+")) {
            if (!part.isEmpty()) out.append(out.isEmpty() ? "" : " ").append(Character.toUpperCase(part.charAt(0))).append('.');
        }
        return out.toString();
    }

    private Map<String, Object> parseMetadata(String raw) {
        if (raw == null || raw.isBlank()) return Collections.emptyMap();
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private String extractCitizenName(Map<String, Object> metadata) {
        Object citizen = metadata.get("citizen");
        if (citizen instanceof Map<?, ?> citMap) {
            Object name = citMap.get("fullName");
            if (name != null && !name.toString().isBlank()) {
                return name.toString().trim();
            }
        }
        Object participants = metadata.get("participants");
        if (participants instanceof List<?> list && !list.isEmpty()) {
            Object first = list.get(0);
            if (first instanceof Map<?, ?> partMap) {
                Object name = partMap.get("name");
                if (name != null && !name.toString().isBlank()) {
                    return name.toString().trim();
                }
            }
        }
        return "Ciudadano Solicitante";
    }

    private String extractRadicacionType(Map<String, Object> metadata) {
        Object type = metadata.get("radicacionType");
        if (type != null && !type.toString().isBlank()) {
            return type.toString().trim();
        }
        return "Petición / Solicitud Ciudadana";
    }

    private String computeHash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            return UUID.nameUUIDFromBytes(input.getBytes(StandardCharsets.UTF_8)).toString().replace("-", "");
        }
    }
}
