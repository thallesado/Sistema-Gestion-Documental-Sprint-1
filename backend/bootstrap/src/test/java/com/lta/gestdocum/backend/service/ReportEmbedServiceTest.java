package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.ReportEmbedResponse;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ReportEmbedServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void rejectsWhenApiKeyIsNotConfigured() {
        ReportEmbedService service = new ReportEmbedService(
                "http://localhost:8001",
                "http://localhost:3001",
                "",
                "",
                objectMapper
        );

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> service.getEmbedConfig(UUID.randomUUID(), UUID.randomUUID(), "admin")
        );
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
    }

    @Test
    void rejectsWhenTenantIdIsMissing() {
        ReportEmbedService service = new ReportEmbedService(
                "http://localhost:8001",
                "http://localhost:3001",
                "test-key",
                "",
                objectMapper
        );

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> service.getEmbedConfig(null, UUID.randomUUID(), "admin")
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void requestsEmbedTokenAndBuildsEmbedUrl() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v1/embed-tokens", exchange -> {
            byte[] body = "{\"token\":\"tok_123\",\"expires_at\":\"2026-11-13T00:00:00Z\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.start();
        try {
            String apiUrl = "http://localhost:" + server.getAddress().getPort();
            ReportEmbedService service = new ReportEmbedService(
                    apiUrl,
                    "https://reports.example.com",
                    "test-key",
                    "ds-1",
                    objectMapper
            );

            ReportEmbedResponse response = service.getEmbedConfig(UUID.randomUUID(), UUID.randomUUID(), "admin");
            assertEquals("tok_123", response.token());
            assertEquals("https://reports.example.com/embed?token=tok_123", response.embedUrl());
            assertEquals("2026-11-13T00:00:00Z", response.expiresAt());
            assertEquals("ds-1", response.dataSourceId());
        } finally {
            server.stop(0);
        }
    }
}
