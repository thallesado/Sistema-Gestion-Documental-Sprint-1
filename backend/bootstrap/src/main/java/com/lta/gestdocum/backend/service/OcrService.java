package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.OcrProcessResponse;
import com.lta.gestdocum.backend.dto.OcrProcessResponse.OcrFieldDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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
    public static final String DEFAULT_MODEL = "gemini-3.8-flash";

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper;

    public OcrService(String apiKey, String model, int timeoutSeconds, ObjectMapper objectMapper) {
        this(new GeminiClient(apiKey, model, timeoutSeconds, objectMapper), objectMapper);
    }

    public OcrService(String apiKey, String model, int timeoutSeconds, String baseUrl, long retryDelayMs, ObjectMapper objectMapper) {
        this(new GeminiClient(apiKey, model, timeoutSeconds, baseUrl, retryDelayMs, objectMapper), objectMapper);
    }

    @Autowired
    public OcrService(GeminiClient geminiClient, ObjectMapper objectMapper) {
        this.geminiClient = geminiClient;
        this.objectMapper = objectMapper;
    }

    /** Hay API key: sin ella toda extracción termina en fallo explícito. */
    public boolean isConfigured() {
        return geminiClient.isConfigured();
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

    /** Páginas que consume un archivo: 1 por imagen; en un PDF, las páginas del documento (mínimo 1). */
    public static int countPages(byte[] bytes, String mimeType) {
        if (bytes == null || mimeType == null || !mimeType.toLowerCase(Locale.ROOT).contains("pdf")) return 1;
        String text = new String(bytes, java.nio.charset.StandardCharsets.ISO_8859_1);
        java.util.regex.Matcher pages = java.util.regex.Pattern.compile("/Type\\s*/Page(?![A-Za-z])").matcher(text);
        int leaves = 0;
        while (pages.find()) leaves++;
        // PDF con objetos comprimidos: el nodo raíz /Pages declara el total en /Count.
        int declared = 0;
        java.util.regex.Matcher counts = java.util.regex.Pattern.compile("/Count\\s+(\\d{1,6})").matcher(text);
        while (counts.find()) declared = Math.max(declared, Integer.parseInt(counts.group(1)));
        return Math.max(1, Math.max(leaves, declared));
    }

    public OcrExtraction extract(byte[] fileBytes, String mimeType, String originalFilename) {
        long started = System.nanoTime();
        if (!geminiClient.isConfigured()) {
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

        try {
            GeminiClient.RawResult raw = geminiClient.generateRaw(payload);
            OcrExtraction parsed = parseGeminiResponse(raw.responseBody(), originalFilename, raw.modelUsed(), started);
            if (!parsed.fallback()) {
                log.info("Extracción OCR completada con modelo {}", raw.modelUsed());
                return parsed;
            }
            return failure(originalFilename, parsed.failureReason(), started);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            return failure(originalFilename, "Fallo en motor de visión multimodal: " + msg, started);
        }
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
