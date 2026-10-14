package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.OcrProcessResponse;
import com.lta.gestdocum.backend.dto.OcrProcessResponse.OcrFieldDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class OcrService {

    /** Resultado de una extracción: el contenido, qué modelo respondió y si fue un fallo controlado. */
    public record OcrExtraction(OcrProcessResponse data, boolean fallback, String model,
                                String failureReason, long elapsedMs) {
    }

    public static final Set<String> ALLOWED_MIME_TYPES =
            Set.of("application/pdf", "image/jpeg", "image/png", "image/webp");
    public static final Set<String> DOCUMENT_TYPES =
            Set.of("LABORATORIO", "RECETA", "CONSENTIMIENTO", "INFORME_MEDICO", "OTRO");
    /** Probado con documentos reales: el que respondio de forma mas estable (7/7) frente a la saturacion de los demas. */
    private static final String DEFAULT_MODEL = "gemini-3.5-flash-lite";
    private static final String DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
    private static final long DEFAULT_RETRY_DELAY_MS = 1000;
    /** Intentos por modelo ante una sobrecarga transitoria de Google (503, 429, 500...). */
    private static final int MAX_ATTEMPTS = 3;
    private static final Set<Integer> TRANSIENT_STATUS = Set.of(429, 500, 502, 503, 504);

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    private final String apiKey;
    private final String model;
    private final int timeoutSeconds;
    private final String baseUrl;
    private final long retryDelayMs;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OcrService(String apiKey, String model, int timeoutSeconds, ObjectMapper objectMapper) {
        this(apiKey, model, timeoutSeconds, DEFAULT_BASE_URL, DEFAULT_RETRY_DELAY_MS, objectMapper);
    }

    @Autowired
    public OcrService(
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:" + DEFAULT_MODEL + "}") String model,
            @Value("${app.gemini.timeout-seconds:25}") int timeoutSeconds,
            @Value("${app.gemini.base-url:" + DEFAULT_BASE_URL + "}") String baseUrl,
            @Value("${app.gemini.retry-delay-ms:" + DEFAULT_RETRY_DELAY_MS + "}") long retryDelayMs,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? DEFAULT_MODEL : model.trim();
        this.timeoutSeconds = Math.max(timeoutSeconds, 5);
        this.baseUrl = baseUrl == null || baseUrl.isBlank() ? DEFAULT_BASE_URL : baseUrl.trim().replaceAll("/+$", "");
        this.retryDelayMs = Math.max(retryDelayMs, 0);
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /** Hay API key: sin ella toda extracción termina en fallo explícito. */
    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("El archivo a procesar no puede estar vacío");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Formato no soportado para OCR. Debe ser PDF, PNG, JPG o WEBP.");
        }
    }

    public OcrProcessResponse processDocument(MultipartFile file) {
        validateFile(file);
        try {
            return extract(file.getBytes(), file.getContentType().toLowerCase(Locale.ROOT), file.getOriginalFilename()).data();
        } catch (java.io.IOException e) {
            throw new RuntimeException("Error al leer los bytes del archivo", e);
        }
    }

    public OcrExtraction extract(byte[] fileBytes, String mimeType, String originalFilename) {
        long started = System.nanoTime();
        if (apiKey.isBlank()) {
            log.warn("Gemini API Key no configurada; no se puede extraer el documento.");
            return failure(originalFilename, "Servicio de visión no configurado (falta API Key).", started);
        }
        return callGeminiVision(fileBytes, mimeType, originalFilename, started);
    }

    private OcrExtraction callGeminiVision(byte[] fileBytes, String mimeType, String originalFilename, long started) {
        String base64Data = Base64.getEncoder().encodeToString(fileBytes);

        String prompt = """
                Actúa como un motor de OCR y extracción clínica de grado médico institucional.
                Analiza la imagen de este documento (puede ser informe de laboratorio, receta, consentimiento o estudio médico).
                Si la imagen NO contiene texto de un documento (por ejemplo una radiografía, una tomografía o una fotografía clínica),
                devuelve documentType "OTRO", fullText vacío, extractedSummary "Imagen sin texto documental" y confidence menor o igual a 0.3.
                Nunca interpretes ni diagnostiques imágenes médicas: solo transcribe texto y datos escritos.
                Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura (sin comillas invertidas ni bloques markdown):
                {
                  "documentType": "LABORATORIO | RECETA | CONSENTIMIENTO | INFORME_MEDICO | OTRO",
                  "patientName": "Nombre completo extraído o null",
                  "patientDocumentNumber": "Número de documento de identidad/carnet o null",
                  "doctorName": "Nombre del médico firmante o null",
                  "issueDate": "Fecha en formato YYYY-MM-DD o null",
                  "extractedSummary": "Breve resumen de 2 líneas de los hallazgos principales",
                  "fullText": "Transcripción textual completa y fiel del documento",
                  "confidence": 0.95,
                  "structuredFields": [
                    { "key": "Nombre del campo/prueba", "value": "Resultado o dato", "status": "NORMAL | ELEVADO | BAJO | N/A" }
                  ]
                }
                """;

        Map<String, Object> inlineData = Map.of(
                "mime_type", mimeType,
                "data", base64Data
        );

        Map<String, Object> payload = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("text", prompt),
                                Map.of("inline_data", inlineData)
                        )
                ))
        );

        Set<String> candidateModels = new LinkedHashSet<>(List.of(model, DEFAULT_MODEL, "gemini-3.1-flash-lite", "gemini-3.8-flash"));
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
                        OcrExtraction parsed = parseGeminiResponse(response.body(), originalFilename, currentModel, started);
                        if (!parsed.fallback()) {
                            log.info("Extracción OCR completada con modelo {} (intento {})", currentModel, attempt);
                            return parsed;
                        }
                        lastError = parsed.failureReason();
                        break;
                    }
                    lastError = "HTTP " + response.statusCode();
                    retry = TRANSIENT_STATUS.contains(response.statusCode());
                    log.warn("Modelo {} respondió HTTP {} (intento {}/{}){}", currentModel, response.statusCode(),
                            attempt, MAX_ATTEMPTS, retry && attempt < MAX_ATTEMPTS ? ". Reintentando..." : ". Probando siguiente modelo candidato...");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return failure(originalFilename, "Fallo en motor de visión multimodal: interrumpido", started);
                } catch (Exception e) {
                    // Un timeout ya consumió el plazo completo: se pasa al siguiente modelo sin reintentar.
                    log.warn("Excepción llamando a modelo {}: {}. Probando siguiente...", currentModel, e.getMessage());
                    lastError = e.getMessage();
                    break;
                }
                if (!retry) {
                    break;
                }
                if (attempt < MAX_ATTEMPTS && !pause(retryDelayMs * attempt)) {
                    return failure(originalFilename, "Fallo en motor de visión multimodal: interrumpido", started);
                }
            }
        }

        return failure(originalFilename, "Fallo en motor de visión multimodal: " + lastError, started);
    }

    private OcrExtraction parseGeminiResponse(String responseBody, String originalFilename, String usedModel, long started) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidates = root.path("candidates");
            if (candidates.isEmpty()) {
                return failure(originalFilename, "Gemini no generó candidatos para la imagen.", started);
            }

            String rawText = candidates.get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText("");

            String cleanJson = rawText.trim();
            if (cleanJson.startsWith("```json")) {
                cleanJson = cleanJson.substring(7);
            } else if (cleanJson.startsWith("```")) {
                cleanJson = cleanJson.substring(3);
            }
            if (cleanJson.endsWith("```")) {
                cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
            }
            cleanJson = cleanJson.trim();

            JsonNode parsed = objectMapper.readTree(cleanJson);
            if (!parsed.isObject()) {
                return failure(originalFilename, "Respuesta no estructurada devuelta por visión: no es un objeto JSON", started);
            }

            String docType = parsed.path("documentType").asText("OTRO").trim().toUpperCase(Locale.ROOT);
            if (!DOCUMENT_TYPES.contains(docType)) {
                docType = "OTRO";
            }
            String patientName = nullableText(parsed, "patientName");
            String patientDoc = nullableText(parsed, "patientDocumentNumber");
            String doctorName = nullableText(parsed, "doctorName");
            String issueDate = nullableText(parsed, "issueDate");
            String summary = parsed.path("extractedSummary").asText("Documento digitalizado mediante visión multimodal.");
            String fullText = parsed.path("fullText").asText("");
            double confidence = normalizeConfidence(parsed.path("confidence").asDouble(0.90));

            List<OcrFieldDTO> fields = new ArrayList<>();
            JsonNode fieldsNode = parsed.path("structuredFields");
            if (fieldsNode.isArray()) {
                for (JsonNode f : fieldsNode) {
                    fields.add(new OcrFieldDTO(
                            f.path("key").asText("Campo"),
                            f.path("value").asText(""),
                            f.path("status").asText("NORMAL")
                    ));
                }
            }

            Map<String, Object> rawMap = objectMapper.convertValue(parsed, new TypeReference<>() {});

            OcrProcessResponse data = new OcrProcessResponse(
                    docType, patientName, patientDoc, doctorName, issueDate,
                    summary, fullText, confidence, fields, rawMap);
            return new OcrExtraction(data, false, usedModel, null, elapsedMs(started));

        } catch (Exception e) {
            log.error("Error al parsear respuesta JSON de Gemini Vision: {}", e.getMessage());
            return failure(originalFilename, "Respuesta no estructurada devuelta por visión: " + e.getMessage(), started);
        }
    }

    /** La base de datos exige 0..1; el modelo a veces responde en porcentaje (95) o fuera de rango. */
    static double normalizeConfidence(double value) {
        if (Double.isNaN(value) || value < 0) {
            return 0.0;
        }
        if (value > 1 && value <= 100) {
            return value / 100.0;
        }
        return Math.min(value, 1.0);
    }

    private static String nullableText(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asText(null);
        return text == null || text.isBlank() || "null".equalsIgnoreCase(text.trim()) ? null : text.trim();
    }

    /** Espera entre reintentos; devuelve false si el hilo fue interrumpido. */
    private static boolean pause(long millis) {
        if (millis <= 0) {
            return true;
        }
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

    private OcrExtraction failure(String filename, String reason, long started) {
        return new OcrExtraction(buildFallbackResponse(filename, reason), true, null, reason, elapsedMs(started));
    }

    private OcrProcessResponse buildFallbackResponse(String filename, String reason) {
        return new OcrProcessResponse(
                "OTRO",
                null,
                null,
                null,
                null,
                "Extracción no completada: " + reason,
                "Texto preliminar no disponible para: " + filename,
                0.50,
                List.of(new OcrFieldDTO("Estado OCR", "Requiere validación manual", "ADVERTENCIA")),
                Map.of("filename", filename != null ? filename : "archivo", "reason", reason)
        );
    }
}
