package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class OcrServiceExtractTest {

    private static final String GEMINI_OK = """
            {"candidates":[{"content":{"parts":[{"text":"```json\\n{\\"documentType\\":\\"LABORATORIO\\",\\"patientName\\":\\"Ana Perez\\",\\"patientDocumentNumber\\":\\"123\\",\\"doctorName\\":null,\\"issueDate\\":\\"2026-10-01\\",\\"extractedSummary\\":\\"Hemograma normal\\",\\"fullText\\":\\"Hemoglobina 14\\",\\"confidence\\":0.93,\\"structuredFields\\":[{\\"key\\":\\"Hemoglobina\\",\\"value\\":\\"14\\",\\"status\\":\\"NORMAL\\"}]}\\n```"}]}}]}
            """;

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private final List<String> requestedPaths = new CopyOnWriteArrayList<>();
    private Function<String, int[]> behaviour;
    private Function<String, String> bodies;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            requestedPaths.add(path);
            assertNotNull(exchange.getRequestHeaders().getFirst("x-goog-api-key"), "la API key va por cabecera");
            int status = behaviour.apply(path)[0];
            byte[] body = bodies.apply(path).getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private OcrService service(String model) {
        return new OcrService("key", model, 5, baseUrl(), mapper);
    }

    @Test
    @DisplayName("extract() devuelve el resultado parseado, el modelo usado y el tiempo medido")
    void extractSuccess() {
        behaviour = path -> new int[]{200};
        bodies = path -> GEMINI_OK;

        OcrService.OcrExtraction result = service("gemini-a").extract("img".getBytes(), "image/png", "x.png");

        assertFalse(result.fallback());
        assertNull(result.failureReason());
        assertEquals("gemini-a", result.model());
        assertEquals("LABORATORIO", result.data().documentType());
        assertEquals("Ana Perez", result.data().patientName());
        assertEquals(0.93, result.data().confidence(), 1e-9);
        assertEquals(1, result.data().structuredFields().size());
        assertTrue(result.elapsedMs() >= 0);
        assertEquals(1, requestedPaths.size());
    }

    @Test
    @DisplayName("extract() pasa al siguiente modelo cuando el primero falla y reporta cual respondio")
    void extractFallsThroughToNextModel() {
        behaviour = path -> new int[]{path.contains("gemini-a") ? 404 : 200};
        bodies = path -> path.contains("gemini-a") ? "{\"error\":\"not found\"}" : GEMINI_OK;

        OcrService.OcrExtraction result = service("gemini-a").extract("img".getBytes(), "image/png", "x.png");

        assertFalse(result.fallback());
        assertEquals("gemini-3.1-flash-lite", result.model());
        assertTrue(requestedPaths.get(0).contains("gemini-a"));
    }

    @Test
    @DisplayName("extract() no repite un modelo candidato duplicado")
    void extractDeduplicatesCandidates() {
        behaviour = path -> new int[]{500};
        bodies = path -> "{}";

        OcrService.OcrExtraction result = service("gemini-3.8-flash").extract("img".getBytes(), "image/png", "x.png");

        assertEquals(2, requestedPaths.size(), "gemini-3.8-flash configurado + gemini-3.1-flash-lite, sin repetir");
        assertTrue(result.fallback());
        assertTrue(result.failureReason().contains("HTTP 500"));
        assertNull(result.model());
    }

    @Test
    @DisplayName("isConfigured() refleja si hay API key")
    void isConfiguredReflectsApiKey() {
        assertTrue(service("gemini-a").isConfigured());
        assertFalse(new OcrService(" ", "gemini-a", 5, baseUrl(), mapper).isConfigured());
    }

    @Test
    @DisplayName("extract() sin API key es un fallo explicito, no una extraccion")
    void extractWithoutApiKeyIsFallback() {
        OcrService unconfigured = new OcrService("", "gemini-a", 5, baseUrl(), mapper);

        OcrService.OcrExtraction result = unconfigured.extract("img".getBytes(), "image/png", "x.png");

        assertTrue(result.fallback());
        assertTrue(result.failureReason().contains("falta API Key"));
        assertEquals(0, requestedPaths.size());
    }

    @Test
    @DisplayName("extract() trata una respuesta no estructurada como fallo")
    void extractUnparseableIsFallback() {
        behaviour = path -> new int[]{200};
        bodies = path -> "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"no soy json\"}]}}]}";

        OcrService.OcrExtraction result = service("gemini-a").extract("img".getBytes(), "image/png", "x.png");

        assertTrue(result.fallback());
        assertTrue(result.failureReason().contains("no estructurada"));
    }

    @Test
    @DisplayName("la confianza se normaliza al rango 0..1 que exige la base de datos")
    void confidenceIsNormalised() {
        assertEquals(0.95, OcrService.normalizeConfidence(95), 1e-9);
        assertEquals(0.8, OcrService.normalizeConfidence(0.8), 1e-9);
        assertEquals(0.0, OcrService.normalizeConfidence(-3), 1e-9);
        assertEquals(1.0, OcrService.normalizeConfidence(250), 1e-9);
        assertEquals(0.0, OcrService.normalizeConfidence(Double.NaN), 1e-9);
    }

    @Test
    @DisplayName("un tipo documental fuera del catalogo se reporta como OTRO")
    void unknownDocumentTypeBecomesOther() {
        behaviour = path -> new int[]{200};
        bodies = path -> GEMINI_OK.replace("LABORATORIO", "RADIOGRAFIA");

        OcrService.OcrExtraction result = service("gemini-a").extract("img".getBytes(), "image/png", "x.png");

        assertEquals("OTRO", result.data().documentType());
    }

    @Test
    @DisplayName("validateFile() acepta PDF, JPEG, PNG y WEBP y rechaza el resto")
    void validateFileAllowlist() {
        OcrService s = service("gemini-a");
        for (String type : List.of("application/pdf", "image/jpeg", "image/png", "image/webp")) {
            assertDoesNotThrow(() -> s.validateFile(new MockMultipartFile("file", "f", type, new byte[]{1})), type);
        }
        List<String> rejected = new ArrayList<>(List.of("image/gif", "image/tiff", "application/dicom", "text/plain"));
        for (String type : rejected) {
            assertThrows(IllegalArgumentException.class,
                    () -> s.validateFile(new MockMultipartFile("file", "f", type, new byte[]{1})), type);
        }
        assertThrows(IllegalArgumentException.class,
                () -> s.validateFile(new MockMultipartFile("file", "f", "image/png", new byte[0])));
        assertThrows(IllegalArgumentException.class, () -> s.validateFile(null));
    }
}
