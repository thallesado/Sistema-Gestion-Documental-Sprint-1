package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.OcrProcessResponse;
import com.lta.gestdocum.backend.dto.OcrProcessResponse.OcrFieldDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    private final String apiKey;
    private final String model;
    private final int timeoutSeconds;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public OcrService(
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-3.8-flash}") String model,
            @Value("${app.gemini.timeout-seconds:25}") int timeoutSeconds,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-3.8-flash" : model.trim();
        this.timeoutSeconds = Math.max(timeoutSeconds, 5);
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public OcrProcessResponse processDocument(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("El archivo a procesar no puede estar vacío");
        }

        String contentType = file.getContentType();
        if (contentType == null || (!contentType.startsWith("image/") && !contentType.equals("application/pdf"))) {
            throw new IllegalArgumentException("Formato no soportado para OCR. Debe ser imagen (PNG, JPG, WEBP) o PDF.");
        }

        byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Error al leer los bytes del archivo", e);
        }

        if (apiKey.isBlank()) {
            log.warn("Gemini API Key no configurada; retornando extracción preliminar por fallback.");
            return buildFallbackResponse(file.getOriginalFilename(), "Servicio de visión no configurado (falta API Key).");
        }

        return callGeminiVision(fileBytes, contentType, file.getOriginalFilename());
    }

    private OcrProcessResponse callGeminiVision(byte[] fileBytes, String mimeType, String originalFilename) {
        String base64Data = Base64.getEncoder().encodeToString(fileBytes);

        String prompt = """
                Actúa como un motor de OCR y extracción clínica de grado médico institucional.
                Analiza la imagen de este documento (puede ser informe de laboratorio, receta, consentimiento o estudio médico).
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

        List<String> candidateModels = List.of(model, "gemini-3.1-flash-lite", "gemini-3.8-flash");
        String lastError = null;

        for (String currentModel : candidateModels) {
            String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", currentModel);
            try {
                String jsonBody = objectMapper.writeValueAsString(payload);
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(timeoutSeconds))
                        .header("Content-Type", "application/json")
                        .header("x-goog-api-key", apiKey.trim())
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    log.info("Extracción OCR completada exitosamente con modelo {}", currentModel);
                    return parseGeminiResponse(response.body(), originalFilename);
                }

                log.warn("Modelo {} respondió HTTP {}: {}. Probando siguiente modelo candidato...",
                        currentModel, response.statusCode(), response.body());
                lastError = "HTTP " + response.statusCode();
            } catch (Exception e) {
                log.warn("Excepción llamando a modelo {}: {}. Probando siguiente...", currentModel, e.getMessage());
                lastError = e.getMessage();
            }
        }

        return buildFallbackResponse(originalFilename, "Fallo en motor de visión multimodal: " + lastError);
    }

    private OcrProcessResponse parseGeminiResponse(String responseBody, String originalFilename) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidates = root.path("candidates");
            if (candidates.isEmpty()) {
                return buildFallbackResponse(originalFilename, "Gemini no generó candidatos para la imagen.");
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

            String docType = parsed.path("documentType").asText("OTRO");
            String patientName = parsed.path("patientName").isNull() ? null : parsed.path("patientName").asText(null);
            String patientDoc = parsed.path("patientDocumentNumber").isNull() ? null : parsed.path("patientDocumentNumber").asText(null);
            String doctorName = parsed.path("doctorName").isNull() ? null : parsed.path("doctorName").asText(null);
            String issueDate = parsed.path("issueDate").isNull() ? null : parsed.path("issueDate").asText(null);
            String summary = parsed.path("extractedSummary").asText("Documento digitalizado mediante visión multimodal.");
            String fullText = parsed.path("fullText").asText("");
            double confidence = parsed.path("confidence").asDouble(0.90);

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

            return new OcrProcessResponse(
                    docType,
                    patientName,
                    patientDoc,
                    doctorName,
                    issueDate,
                    summary,
                    fullText,
                    confidence,
                    fields,
                    rawMap
            );

        } catch (Exception e) {
            log.error("Error al parsear respuesta JSON de Gemini Vision: {}", e.getMessage(), e);
            return buildFallbackResponse(originalFilename, "Respuesta no estructurada devuelta por visión: " + e.getMessage());
        }
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
