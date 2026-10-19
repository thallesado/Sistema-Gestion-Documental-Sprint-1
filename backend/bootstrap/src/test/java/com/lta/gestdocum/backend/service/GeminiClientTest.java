package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class GeminiClientTest {

    private static final String GEMINI_TEXT_OK = """
            {
              "candidates": [
                {
                  "content": {
                    "parts": [
                      {
                        "text": "Hola, soy el asistente virtual de NexoDocs."
                      }
                    ]
                  }
                }
              ]
            }
            """;

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private final List<String> requestedPaths = new CopyOnWriteArrayList<>();
    private final List<String> receivedPayloads = new CopyOnWriteArrayList<>();
    private Function<String, Integer> statusFunction;
    private Function<String, String> bodyFunction;

    @BeforeEach
    void startServer() throws IOException {
        requestedPaths.clear();
        receivedPayloads.clear();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            requestedPaths.add(path);
            assertEquals("test-api-key", exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            receivedPayloads.add(requestBody);

            int status = statusFunction.apply(path);
            byte[] responseBytes = bodyFunction.apply(path).getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, responseBytes.length);
            exchange.getResponseBody().write(responseBytes);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private GeminiClient client(String apiKey, String model) {
        return new GeminiClient(
                apiKey,
                model,
                5,
                baseUrl(),
                0, // sin delay para tests rápidos
                mapper
        );
    }

    @Test
    @DisplayName("isConfigured reporta false cuando falta la API key y true cuando está presente")
    void testIsConfigured() {
        GeminiClient unconfigured1 = new GeminiClient("", "gemini-3.5-flash-lite", 5, mapper);
        assertFalse(unconfigured1.isConfigured());

        GeminiClient unconfigured2 = new GeminiClient("   ", "gemini-3.5-flash-lite", 5, mapper);
        assertFalse(unconfigured2.isConfigured());

        GeminiClient configured = new GeminiClient("valid-key", "gemini-3.5-flash-lite", 5, mapper);
        assertTrue(configured.isConfigured());
    }

    @Test
    @DisplayName("generateText lanza IllegalStateException si la API key no está configurada")
    void testUnconfiguredThrows() {
        GeminiClient unconfigured = new GeminiClient("", "gemini-3.5-flash-lite", 5, mapper);
        assertThrows(IllegalStateException.class, () -> unconfigured.generateText("hola"));
    }

    @Test
    @DisplayName("generateText exitoso devuelve el texto del candidato, el modelo usado y tiempo transcurrido")
    void testGenerateTextSuccess() {
        statusFunction = path -> 200;
        bodyFunction = path -> GEMINI_TEXT_OK;

        GeminiClient client = client("test-api-key", "gemini-3.5-flash-lite");
        GeminiClient.TextResult result = client.generateText("Hola asistente");

        assertNotNull(result);
        assertEquals("Hola, soy el asistente virtual de NexoDocs.", result.text());
        assertEquals("gemini-3.5-flash-lite", result.modelUsed());
        assertTrue(result.elapsedMs() >= 0);
        assertEquals(1, requestedPaths.size());
        assertTrue(requestedPaths.get(0).contains("gemini-3.5-flash-lite"));
    }

    @Test
    @DisplayName("generateText con systemInstruction serializa adecuadamente la instrucción de sistema")
    void testGenerateTextWithSystemInstruction() throws Exception {
        statusFunction = path -> 200;
        bodyFunction = path -> GEMINI_TEXT_OK;

        GeminiClient client = client("test-api-key", "gemini-3.5-flash-lite");
        GeminiClient.TextResult result = client.generateText("Hola", "Sos un asistente hospitalario");

        assertEquals("Hola, soy el asistente virtual de NexoDocs.", result.text());
        assertEquals(1, receivedPayloads.size());

        JsonNode payload = mapper.readTree(receivedPayloads.get(0));
        assertTrue(payload.has("system_instruction"));
        assertEquals("Sos un asistente hospitalario",
                payload.path("system_instruction").path("parts").get(0).path("text").asText());
    }

    @Test
    @DisplayName("generateRaw reintenta ante errores transitorios (503) y se recupera")
    void testRetriesTransientErrors() {
        AtomicInteger attempts = new AtomicInteger();
        statusFunction = path -> attempts.incrementAndGet() <= 2 ? 503 : 200;
        bodyFunction = path -> attempts.get() <= 2 ? "{\"error\":\"temporarily unavailable\"}" : GEMINI_TEXT_OK;

        GeminiClient client = client("test-api-key", "gemini-custom");
        GeminiClient.RawResult raw = client.generateRaw(Map.of("test", "data"));

        assertEquals(3, attempts.get());
        assertEquals("gemini-custom", raw.modelUsed());
        assertEquals(3, requestedPaths.size());
        assertTrue(requestedPaths.get(0).contains("gemini-custom"));
    }

    @Test
    @DisplayName("generateRaw rota al siguiente modelo candidato cuando el primario falla no transitoriamente")
    void testFallbackToNextModel() {
        statusFunction = path -> path.contains("primary-broken") ? 404 : 200;
        bodyFunction = path -> path.contains("primary-broken") ? "{\"error\":\"not found\"}" : GEMINI_TEXT_OK;

        GeminiClient client = client("test-api-key", "primary-broken");
        GeminiClient.RawResult raw = client.generateRaw(Map.of("test", "data"));

        assertEquals(2, requestedPaths.size());
        assertTrue(requestedPaths.get(0).contains("primary-broken"));
        assertTrue(requestedPaths.get(1).contains(GeminiClient.DEFAULT_MODEL));
        assertEquals(GeminiClient.DEFAULT_MODEL, raw.modelUsed());
    }

    @Test
    @DisplayName("extractFirstCandidateText lanza excepción si no hay candidatos en la respuesta")
    void testExtractFirstCandidateTextEmptyCandidates() {
        GeminiClient client = client("test-api-key", "gemini-3.5-flash-lite");
        assertThrows(RuntimeException.class, () -> client.extractFirstCandidateText("{\"candidates\":[]}"));
    }
}
