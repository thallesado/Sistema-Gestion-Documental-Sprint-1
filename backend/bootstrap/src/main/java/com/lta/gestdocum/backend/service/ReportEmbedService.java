package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.ReportEmbedResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ReportEmbedService(
            @Value("${app.reportiq.api-url:http://localhost:8001}") String apiUrl,
            @Value("${app.reportiq.frontend-url:http://localhost:3001}") String frontendUrl,
            @Value("${app.reportiq.api-key:f0792c45-16c2-4a3c-ab0e-3a4adbc2791d.ri_live_5EEny7JHy4pjzD55d5t6px_cFMgyDZj5HbyN8Al34Y0}") String apiKey,
            ObjectMapper objectMapper) {
        this.apiUrl = (apiUrl != null && !apiUrl.isBlank()) ? apiUrl.trim() : "http://localhost:8001";
        this.frontendUrl = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl.trim() : "http://localhost:3001";
        this.apiKey = (apiKey != null && !apiKey.isBlank())
                ? apiKey.trim()
                : "f0792c45-16c2-4a3c-ab0e-3a4adbc2791d.ri_live_5EEny7JHy4pjzD55d5t6px_cFMgyDZj5HbyN8Al34Y0";
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public ReportEmbedResponse getEmbedConfig(UUID tenantId, UUID userId, String role) {
        String effectiveTenantValue = tenantId != null ? tenantId.toString() : "20000000-0000-0000-0000-000000000001";
        String effectiveUserId = userId != null ? userId.toString() : "admin-nexodocs";
        String effectiveRole = (role != null && !role.isBlank()) ? role : "admin";

        log.info("Solicitando Embed Token a ReportIQ ({}) para tenant: {}", apiUrl, effectiveTenantValue);

        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("tenant_value", effectiveTenantValue);
            requestBody.put("end_user_id", effectiveUserId);
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
                log.error("ReportIQ /v1/embed-tokens error (HTTP {}): {}", response.statusCode(), response.body());
                throw new IllegalStateException("Error al comunicarse con ReportIQ: " + response.body());
            }

            JsonNode root = objectMapper.readTree(response.body());
            String token = root.path("token").asText();
            String expiresAt = root.path("expires_at").asText();

            String embedUrl = frontendUrl + "/embed?token=" + token;

            return new ReportEmbedResponse(token, embedUrl, expiresAt, "6703edc9-7436-45c3-b71d-360adfdf6916");
        } catch (Exception e) {
            log.error("Error al generar Embed Token de ReportIQ", e);
            throw new RuntimeException("No se pudo generar la sesión de reportes con ReportIQ: " + e.getMessage(), e);
        }
    }
}
