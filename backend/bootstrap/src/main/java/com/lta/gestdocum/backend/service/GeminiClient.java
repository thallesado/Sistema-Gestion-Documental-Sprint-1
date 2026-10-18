package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Cliente compartido para la API de Google Gemini (v1beta).
 * Soporta llamadas multimodales (visión / documentos OCR) y generación de texto
 * (asistente virtual, extracción estructurada y análisis de consultas por voz).
 * Maneja reintentos con backoff ante errores transitorios (429, 500, 502, 503, 504)
 * y rotación automática sobre una lista priorizada de modelos candidatos.
 */
@Component
public class GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);

    public static final String DEFAULT_MODEL = "gemini-3.5-flash-lite";
    public static final String DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
    public static final long DEFAULT_RETRY_DELAY_MS = 1000;
    public static final int MAX_ATTEMPTS = 3;
    public static final Set<Integer> TRANSIENT_STATUS = Set.of(429, 500, 502, 503, 504);
    public static final List<String> FALLBACK_MODELS = List.of(DEFAULT_MODEL, "gemini-3.1-flash-lite", "gemini-3.8-flash");

    /** Resultado de una llamada cruda a Gemini con metadatos de ejecución. */
    public record RawResult(String responseBody, String modelUsed, long elapsedMs) {}

    /** Resultado de una generación de texto. */
    public record TextResult(String text, String modelUsed, long elapsedMs) {}

    private final String apiKey;
    private final String model;
    private final int timeoutSeconds;
    private final String baseUrl;
    private final long retryDelayMs;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public GeminiClient(String apiKey, String model, int timeoutSeconds, ObjectMapper objectMapper) {
        this(apiKey, model, timeoutSeconds, DEFAULT_BASE_URL, DEFAULT_RETRY_DELAY_MS, objectMapper);
    }

    @Autowired
    public GeminiClient(
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:" + DEFAULT_MODEL + "}") String model,
            @Value("${app.gemini.timeout-seconds:25}") int timeoutSeconds,
            @Value("${app.gemini.base-url:" + DEFAULT_BASE_URL + "}") String baseUrl,
            @Value("${app.gemini.retry-delay-ms:" + DEFAULT_RETRY_DELAY_MS + "}") long retryDelayMs,
            ObjectMapper objectMapper) {
        this(apiKey, model, timeoutSeconds, baseUrl, retryDelayMs, objectMapper,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    public GeminiClient(String apiKey, String model, int timeoutSeconds, String baseUrl, long retryDelayMs,
                        ObjectMapper objectMapper, HttpClient httpClient) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        this.timeoutSeconds = Math.max(timeoutSeconds, 5);
        this.baseUrl = baseUrl == null || baseUrl.isBlank() ? DEFAULT_BASE_URL : baseUrl.trim().replaceAll("/+$", "");
        this.retryDelayMs = Math.max(retryDelayMs, 0);
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    /** Hay API key configurada: sin ella toda llamada termina en fallo explícito. */
    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public String getModel() {
        return model;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    /**
     * Envía un payload arbitrario a Gemini (`generateContent`) rotando entre los modelos candidatos
     * y reintentando errores transitorios (429, 500, 502, 503, 504) con backoff.
     */
    public RawResult generateRaw(Map<String, Object> payload) {
        if (!isConfigured()) {
            throw new IllegalStateException("Servicio Gemini no configurado (falta API Key).");
        }

        long started = System.nanoTime();
        Set<String> candidateModels = getCandidateModels();
        String lastError = null;

        for (String currentModel : candidateModels) {
            String url = String.format("%s/v1beta/models/%s:generateContent", baseUrl, currentModel);
            for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                boolean retry = false;
                try {
                    String jsonBody = objectMapper.writeValueAsString(payload);
                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .timeout(Duration.ofSeconds(timeoutSeconds))
                            .header("Content-Type", "application/json")
                            .header("x-goog-api-key", apiKey)
                            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    if (response.statusCode() == 200) {
                        long elapsed = elapsedMs(started);
                        log.info("Llamada Gemini completada con modelo {} (intento {}) en {} ms", currentModel, attempt, elapsed);
                        return new RawResult(response.body(), currentModel, elapsed);
                    }
                    lastError = "HTTP " + response.statusCode();
                    retry = TRANSIENT_STATUS.contains(response.statusCode());
                    log.warn("Modelo {} respondió HTTP {} (intento {}/{}){}", currentModel, response.statusCode(),
                            attempt, MAX_ATTEMPTS, retry && attempt < MAX_ATTEMPTS ? ". Reintentando..." : ". Probando siguiente modelo candidato...");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("interrumpido", e);
                } catch (Exception e) {
                    log.warn("Excepción llamando a modelo {}: {}. Probando siguiente...", currentModel, e.getMessage());
                    lastError = e.getMessage();
                    break;
                }
                if (!retry) {
                    break;
                }
                if (attempt < MAX_ATTEMPTS && !pause(retryDelayMs * attempt)) {
                    throw new RuntimeException("interrumpido");
                }
            }
        }

        throw new RuntimeException(lastError != null ? lastError : "Fallo desconocido en Gemini");
    }

    /**
     * Generación de texto para el asistente virtual o consultas analíticas.
     * Soporta opcionalmente instrucciones de sistema (system prompt).
     */
    public TextResult generateText(String prompt, String systemInstruction) {
        List<Map<String, Object>> contents = List.of(
                Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))
        );
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contents", contents);
        if (systemInstruction != null && !systemInstruction.isBlank()) {
            payload.put("system_instruction", Map.of(
                    "parts", List.of(Map.of("text", systemInstruction.trim()))
            ));
        }

        RawResult raw = generateRaw(payload);
        String text = extractFirstCandidateText(raw.responseBody());
        return new TextResult(text, raw.modelUsed(), raw.elapsedMs());
    }

    public TextResult generateText(String prompt) {
        return generateText(prompt, null);
    }

    /** Extrae el texto del primer part del primer candidato de la respuesta JSON. */
    public String extractFirstCandidateText(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidates = root.path("candidates");
            if (candidates.isEmpty()) {
                throw new IllegalStateException("Gemini no generó candidatos para la solicitud.");
            }
            return candidates.get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText("");
        } catch (Exception e) {
            throw new RuntimeException("Error al extraer texto de respuesta Gemini: " + e.getMessage(), e);
        }
    }

    public Set<String> getCandidateModels() {
        Set<String> candidates = new LinkedHashSet<>();
        candidates.add(model);
        candidates.addAll(FALLBACK_MODELS);
        return candidates;
    }

    private static boolean pause(long millis) {
        if (millis <= 0) return true;
        try {
            Thread.sleep(millis);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private static long elapsedMs(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }
}
