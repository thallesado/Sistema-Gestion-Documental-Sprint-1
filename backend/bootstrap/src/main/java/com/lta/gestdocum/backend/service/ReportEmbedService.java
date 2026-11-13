package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.ReportEmbedResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportEmbedService {

    private static final Logger log = LoggerFactory.getLogger(ReportEmbedService.class);

    private final String apiUrl;
    private final String frontendUrl;
    private final String apiKey;
    private final String dataSourceId;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ReportEmbedService(
            @Value("${app.reportiq.api-url:http://localhost:8001}") String apiUrl,
            @Value("${app.reportiq.frontend-url:http://localhost:3001}") String frontendUrl,
            @Value("${app.reportiq.api-key:}") String apiKey,
            @Value("${app.reportiq.data-source-id:}") String dataSourceId,
            ObjectMapper objectMapper) {
        this.apiUrl = (apiUrl != null && !apiUrl.isBlank()) ? apiUrl.trim() : "http://localhost:8001";
        this.frontendUrl = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim() : "http://localhost:3001";
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.dataSourceId = dataSourceId != null ? dataSourceId.trim() : "";
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public ReportEmbedResponse getEmbedConfig(UUID tenantId, UUID userId, String role) {
        if (tenantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Se requiere contexto de organización para reportes.");
        }
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no autenticado.");
        }
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "ReportIQ no está configurado en el servidor (falta REPORTIQ_API_KEY)."
            );
        }

        String effectiveRole = (role != null && !role.isBlank()) ? role : "viewer";
        log.info("Solicitando Embed Token a ReportIQ ({}) para tenant: {}", apiUrl, tenantId);

        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("tenant_value", tenantId.toString());
            requestBody.put("end_user_id", userId.toString());
            requestBody.put("role", effectiveRole);
            requestBody.put("expires_in_minutes", 1440);

            String jsonPayload = objectMapper.writeValueAsString(requestBody);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl + "/v1/embed-tokens"))
                    .version(HttpClient.Version.HTTP_1_1)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                log.error("ReportIQ /v1/embed-tokens error (HTTP {})", response.statusCode());
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "El servicio ReportIQ respondió con error HTTP " + response.statusCode() + "."
                );
            }

            JsonNode root = objectMapper.readTree(response.body());
            String token = root.path("token").asText("");
            String expiresAt = root.path("expires_at").asText("");
            if (token.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Respuesta inválida de ReportIQ.");
            }

            String embedUrl = frontendUrl + "/embed?token=" + token;
            return new ReportEmbedResponse(token, embedUrl, expiresAt, dataSourceId);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error al generar Embed Token de ReportIQ", e);
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "No se pudo conectar con ReportIQ."
            );
        }
    }
}
