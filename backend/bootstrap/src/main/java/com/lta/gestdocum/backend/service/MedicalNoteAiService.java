package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.MedicalNoteAiDraftResponse;
import com.lta.gestdocum.backend.dto.MedicalNoteAiDraftResponse.Warning;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.AllergyEntry;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.MedicationEntry;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.PatientRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Dictado de nota médica por voz (HU-M-XX). Transcribe y estructura el audio en SOAP con Gemini
 * reutilizando {@link GeminiClient} (clave, modelo, timeout y reintentos del OCR).
 * El audio vive solo en memoria durante la petición: no se escribe en disco ni en base de datos.
 * Las advertencias de alergias/medicamentos se calculan aquí, no con IA.
 */
@Service
public class MedicalNoteAiService {

    /** Límite de la subida multipart (criterio de la HU). */
    static final long MAX_AUDIO_BYTES = 25L * 1024 * 1024;
    /**
     * Límite del audio en bruto enviado inline a Gemini. El base64 añade ~4/3 y varias páginas oficiales
     * fijan 20 MB por petición total: 13 MB en bruto son ~17,3 MB en base64 más el prompt.
     * Un WAV PCM 16 kHz mono de 5 minutos pesa ~9,6 MB, así que el límite de 5 minutos siempre cabe.
     */
    static final long MAX_INLINE_AUDIO_BYTES = 13L * 1024 * 1024;
    /**
     * MIME de audio admitidos por la API de Gemini (ai.google.dev, audio understanding):
     * wav, mp3, aiff, aac, ogg y flac. m4a/mp4 no están en esa lista (solo aparecen en Vertex AI).
     */
    static final Map<String, String> SUPPORTED_AUDIO = Map.of(
            "audio/wav", "audio/wav",
            "audio/mp3", "audio/mp3",
            "audio/aiff", "audio/aiff",
            "audio/aac", "audio/aac",
            "audio/ogg", "audio/ogg",
            "audio/flac", "audio/flac");
    static final Set<String> NOTE_TYPES = Set.of("EVOLUTION", "PRESCRIPTION", "CONSULTATION");
    static final String DEFAULT_NOTE_TYPE = "EVOLUTION";
    private static final int MIN_TERM_LENGTH = 3;

    private final GeminiClient geminiClient;
    private final ClinicalHistoryRepository historyRepository;
    private final PatientRepository patientRepository;
    private final AuthenticatedUserContext userContext;
    private final AuditRecorder auditRecorder;
    private final ObjectMapper objectMapper;

    public MedicalNoteAiService(GeminiClient geminiClient, ClinicalHistoryRepository historyRepository,
                                PatientRepository patientRepository, AuthenticatedUserContext userContext,
                                AuditRecorder auditRecorder, ObjectMapper objectMapper) {
        this.geminiClient = geminiClient;
        this.historyRepository = historyRepository;
        this.patientRepository = patientRepository;
        this.userContext = userContext;
        this.auditRecorder = auditRecorder;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public MedicalNoteAiDraftResponse draft(MultipartFile audio, UUID clinicalHistoryId, String requestedLanguage) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();

        ClinicalHistory history = historyRepository.findByIdAndTenantIdAndDeletedAtIsNull(clinicalHistoryId, tenantId)
                .orElseThrow(() -> new NotFoundException("Historia clínica no encontrada"));
        Patient patient = patientRepository.findByIdAndTenantIdAndDeletedAtIsNull(history.getPatientId(), tenantId)
                .orElseThrow(() -> new NotFoundException("Paciente no encontrado"));

        String mimeType = validateAudio(audio);
        if (!geminiClient.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Servicio de IA no configurado (falta la clave de Gemini)");
        }
        String language = normalizeLanguage(requestedLanguage);

        String rawAudio;
        try {
            rawAudio = Base64.getEncoder().encodeToString(audio.getBytes());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo leer el audio");
        }

        Map<String, Object> payload = buildPayload(prompt(language), mimeType, rawAudio);
        String text;
        try {
            GeminiClient.RawResult raw = geminiClient.generateRaw(payload);
            text = geminiClient.extractFirstCandidateText(raw.responseBody());
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "La IA no pudo procesar el audio. Reintente o escriba la nota manualmente");
        }

        MedicalNoteAiDraftResponse draft = parseDraft(text, history);
        if (draft.transcript() == null || draft.transcript().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "No se detectó voz en el audio. Reintente o escriba la nota manualmente");
        }

        if (auditRecorder != null) {
            // Solo metadatos: sin transcripción ni contenido clínico en el detalle.
            auditRecorder.record("AI_DRAFT", "CLINICAL_HISTORIES", clinicalHistoryId, null,
                    Map.of("feature", "MEDICAL_NOTE_VOICE_DRAFT",
                            "noteType", draft.noteType(),
                            "language", language,
                            "warningCount", draft.warnings().size()));
        }
        return draft;
    }

    /** Valida tamaño, formato y que el audio no esté vacío. Devuelve el MIME normalizado. */
    String validateAudio(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El audio es obligatorio");
        }
        if (audio.getSize() > MAX_AUDIO_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "El audio supera el máximo de 25 MB");
        }
        if (audio.getSize() > MAX_INLINE_AUDIO_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "El audio es demasiado largo para analizarlo con IA (máximo 13 MB, unos 6 minutos en WAV)");
        }
        String contentType = audio.getContentType() == null ? "" : audio.getContentType().toLowerCase(Locale.ROOT);
        int semicolon = contentType.indexOf(';');
        if (semicolon >= 0) {
            contentType = contentType.substring(0, semicolon).trim();
        }
        String mime = SUPPORTED_AUDIO.get(contentType);
        if (mime == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Formato de audio no admitido. Use WAV, MP3, AIFF, AAC, OGG o FLAC");
        }
        return mime;
    }

    static String normalizeLanguage(String requested) {
        if (requested == null) return "es";
        String lang = requested.trim().toLowerCase(Locale.ROOT);
        return lang.startsWith("en") ? "en" : "es";
    }

    static Map<String, Object> buildPayload(String prompt, String mimeType, String base64Audio) {
        Map<String, Object> inlineData = Map.of("mime_type", mimeType, "data", base64Audio);
        return Map.of(
                "contents", List.of(Map.of("parts", List.of(
                        Map.of("text", prompt),
                        Map.of("inline_data", inlineData)))),
                "generation_config", Map.of(
                        "response_mime_type", "application/json",
                        "temperature", 0.1));
    }

    static String prompt(String language) {
        if ("en".equals(language)) {
            return """
                    You are a clinical documentation assistant. Transcribe the attached medical dictation and
                    organize it as a SOAP note in English.
                    Rules: use only information stated in the audio. If a section is not mentioned, return an empty string.
                    Do not invent diagnoses, medications, doses, or data. Choose noteType among EVOLUTION (patient progress),
                    PRESCRIPTION (medication or treatment orders) or CONSULTATION (initial consultation).
                    Respond ONLY with a valid JSON object with exactly these keys:
                    {"transcript": "...", "noteType": "EVOLUTION|PRESCRIPTION|CONSULTATION", "subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}
                    """;
        }
        return """
                Eres un asistente de documentación clínica. Transcribe el dictado médico adjunto y organízalo
                como nota SOAP en español.
                Reglas: usa solo información dicha en el audio. Si un apartado no se menciona, devuelve una cadena vacía.
                No inventes diagnósticos, medicamentos, dosis ni datos. Elige noteType entre EVOLUTION (evolución del paciente),
                PRESCRIPTION (indicación de medicamentos o tratamiento) o CONSULTATION (consulta inicial).
                Responde SOLO con un objeto JSON válido con exactamente estas claves:
                {"transcript": "...", "noteType": "EVOLUTION|PRESCRIPTION|CONSULTATION", "subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}
                """;
    }

    /** Parseo estricto: si la respuesta no es un objeto JSON válido, error controlado. */
    MedicalNoteAiDraftResponse parseDraft(String text, ClinicalHistory history) {
        JsonNode root;
        try {
            root = objectMapper.readTree(text == null ? "" : text);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "La IA devolvió una respuesta no válida. Reintente o escriba la nota manualmente");
        }
        if (root == null || !root.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "La IA devolvió una respuesta no válida. Reintente o escriba la nota manualmente");
        }
        String transcript = textOf(root, "transcript");
        String noteType = textOf(root, "noteType").toUpperCase(Locale.ROOT);
        if (!NOTE_TYPES.contains(noteType)) {
            noteType = DEFAULT_NOTE_TYPE;
        }
        return new MedicalNoteAiDraftResponse(
                transcript,
                noteType,
                textOf(root, "subjective"),
                textOf(root, "objective"),
                textOf(root, "assessment"),
                textOf(root, "plan"),
                findWarnings(transcript, history));
    }

    private static String textOf(JsonNode root, String field) {
        JsonNode node = root.get(field);
        return node != null && node.isTextual() ? node.asText().trim() : "";
    }

    /** Coincidencias literales (sin mayúsculas ni tildes) entre el dictado y la historia clínica. */
    static List<Warning> findWarnings(String transcript, ClinicalHistory history) {
        List<Warning> warnings = new ArrayList<>();
        if (transcript == null || transcript.isBlank() || history == null) {
            return warnings;
        }
        String folded = fold(transcript);
        Set<String> seen = new LinkedHashSet<>();
        for (AllergyEntry allergy : safe(history.getAllergies())) {
            addIfMentioned(warnings, seen, "ALLERGY", allergy.allergen(), folded);
        }
        for (MedicationEntry medication : safe(history.getCurrentMedications())) {
            addIfMentioned(warnings, seen, "MEDICATION", medication.name(), folded);
        }
        return warnings;
    }

    private static void addIfMentioned(List<Warning> warnings, Set<String> seen, String type, String term, String foldedTranscript) {
        if (term == null) return;
        String folded = fold(term);
        if (folded.length() < MIN_TERM_LENGTH) return;
        Pattern pattern = Pattern.compile("(?<!\\p{L})" + Pattern.quote(folded) + "(?!\\p{L})");
        if (pattern.matcher(foldedTranscript).find() && seen.add(type + "|" + folded)) {
            warnings.add(new Warning(type, term.trim()));
        }
    }

    static String fold(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private static <T> List<T> safe(List<T> list) {
        return list == null ? List.of() : list;
    }
}
