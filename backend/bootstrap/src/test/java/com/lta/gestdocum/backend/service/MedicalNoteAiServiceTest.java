package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.controller.MedicalNoteController;
import com.lta.gestdocum.backend.dto.MedicalNoteAiDraftResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.AllergyEntry;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.MedicationEntry;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.PatientRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicalNoteAiServiceTest {

    @Mock private GeminiClient geminiClient;
    @Mock private ClinicalHistoryRepository historyRepository;
    @Mock private PatientRepository patientRepository;
    @Mock private AuthenticatedUserContext userContext;
    @Mock private AuditRecorder auditRecorder;

    private MedicalNoteAiService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID patientId = UUID.randomUUID();
    private final UUID historyId = UUID.randomUUID();

    private ClinicalHistory history;

    @BeforeEach
    void setUp() {
        service = new MedicalNoteAiService(geminiClient, historyRepository, patientRepository,
                userContext, auditRecorder, new ObjectMapper());
        history = ClinicalHistory.builder()
                .id(historyId).tenantId(tenantId).patientId(patientId)
                .allergies(new java.util.ArrayList<>(List.of(new AllergyEntry("Penicilina", "ALTA", "urticaria"))))
                .currentMedications(new java.util.ArrayList<>(List.of(new MedicationEntry("Metformina", "850 mg", "cada 12 h"))))
                .build();
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(historyRepository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId))
                .thenReturn(Optional.of(history));
        lenient().when(patientRepository.findByIdAndTenantIdAndDeletedAtIsNull(patientId, tenantId))
                .thenReturn(Optional.of(Patient.builder().id(patientId).tenantId(tenantId).build()));
        lenient().when(geminiClient.isConfigured()).thenReturn(true);
    }

    private static MultipartFile wav() {
        return new MockMultipartFile("audio", "dictado.wav", "audio/wav", new byte[]{1, 2, 3, 4});
    }

    private void geminiReturns(String modelText) {
        when(geminiClient.generateRaw(anyMap())).thenReturn(new GeminiClient.RawResult("{}", "gemini-test", 1));
        when(geminiClient.extractFirstCandidateText("{}")).thenReturn(modelText);
    }

    @Test
    void exitoConEstructuraSoapYAdvertenciasDeAlergiaYMedicamento() {
        geminiReturns("""
                {"transcript":"Paciente refiere alergia a la penicilina y continúa con metformina.",
                 "noteType":"PRESCRIPTION","subjective":"Refiere mejoría","objective":"",
                 "assessment":"Diabetes controlada","plan":"Mantener tratamiento"}
                """);

        MedicalNoteAiDraftResponse draft = service.draft(wav(), historyId, "es-PE");

        assertEquals("PRESCRIPTION", draft.noteType());
        assertEquals("Refiere mejoría", draft.subjective());
        assertEquals("", draft.objective());
        assertEquals("Diabetes controlada", draft.assessment());
        assertEquals("Mantener tratamiento", draft.plan());
        assertEquals(2, draft.warnings().size());
        assertEquals("ALLERGY", draft.warnings().get(0).type());
        assertEquals("Penicilina", draft.warnings().get(0).term());
        assertEquals("MEDICATION", draft.warnings().get(1).type());
    }

    @Test
    void enviaAudioConMimeSoportadoYPideRespuestaJson() {
        geminiReturns("{\"transcript\":\"hola\",\"noteType\":\"EVOLUTION\"}");

        service.draft(wav(), historyId, "es");

        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(geminiClient).generateRaw(payload.capture());
        String json = payload.getValue().toString();
        assertTrue(json.contains("audio/wav"));
        assertTrue(json.contains("application/json"));
    }

    @Test
    void auditoriaSinContenidoClinico() {
        geminiReturns("{\"transcript\":\"alergia a penicilina\",\"noteType\":\"EVOLUTION\"}");

        service.draft(wav(), historyId, "es");

        ArgumentCaptor<Map<String, Object>> after = ArgumentCaptor.forClass(Map.class);
        verify(auditRecorder).record(eq("AI_DRAFT"), eq("CLINICAL_HISTORIES"), eq(historyId), isNull(), after.capture());
        assertFalse(after.getValue().containsKey("transcript"));
        assertFalse(after.getValue().toString().toLowerCase().contains("penicilina"));
        assertEquals(1, after.getValue().get("warningCount"));
    }

    @Test
    void jsonInvalidoDevuelveErrorControlado() {
        geminiReturns("esto no es json");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.draft(wav(), historyId, "es"));
        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        verifyNoInteractions(auditRecorder);
    }

    @Test
    void respuestaSinTranscripcionSeRechaza() {
        geminiReturns("{\"transcript\":\"  \",\"noteType\":\"EVOLUTION\"}");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.draft(wav(), historyId, "es"));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, ex.getStatusCode());
    }

    @Test
    void tipoDesconocidoSeConvierteEnEvolucion() {
        geminiReturns("{\"transcript\":\"texto\",\"noteType\":\"DIAGNOSIS\"}");

        assertEquals("EVOLUTION", service.draft(wav(), historyId, "es").noteType());
    }

    @Test
    void sinClaveGeminiDevuelve503SinLlamarALaIa() {
        when(geminiClient.isConfigured()).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.draft(wav(), historyId, "es"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
        verify(geminiClient, never()).generateRaw(anyMap());
    }

    @Test
    void historiaDeOtroTenantSeRechaza() {
        UUID otherTenant = UUID.randomUUID();
        when(userContext.requireTenantId()).thenReturn(otherTenant);

        assertThrows(NotFoundException.class, () -> service.draft(wav(), historyId, "es"));
        verify(geminiClient, never()).generateRaw(anyMap());
        verifyNoInteractions(auditRecorder);
    }

    @Test
    void pacienteNoAccesibleSeRechaza() {
        when(patientRepository.findByIdAndTenantIdAndDeletedAtIsNull(patientId, tenantId)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.draft(wav(), historyId, "es"));
        verify(geminiClient, never()).generateRaw(anyMap());
    }

    @Test
    void formatoNoAdmitidoSeRechaza() {
        MultipartFile webm = new MockMultipartFile("audio", "a.webm", "video/webm", new byte[]{1});

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.draft(webm, historyId, "es"));
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ex.getStatusCode());
    }

    @Test
    void m4aYMp4SeRechazanPorNoEstarEnLaListaDeGemini() {
        for (String type : List.of("audio/m4a", "audio/mp4")) {
            MultipartFile file = new MockMultipartFile("audio", "a.m4a", type, new byte[]{1, 2});
            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                    () -> service.draft(file, historyId, "es"), type);
            assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ex.getStatusCode(), type);
        }
        verify(geminiClient, never()).generateRaw(anyMap());
    }

    @Test
    void formatosDeLaListaDeGeminiSeAceptan() {
        for (String type : List.of("audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac")) {
            assertEquals(type, service.validateAudio(new MockMultipartFile("audio", "a", type, new byte[]{1})), type);
        }
    }

    @Test
    void audioMayorQueElLimiteInlineSeRechaza413() {
        MultipartFile big = new MockMultipartFile("audio", "a.wav", "audio/wav",
                new byte[(int) MedicalNoteAiService.MAX_INLINE_AUDIO_BYTES + 1]);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.draft(big, historyId, "es"));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.getStatusCode());
        verify(geminiClient, never()).generateRaw(anyMap());
    }

    @Test
    void cincoMinutosDeWavPcm16kMonoCabenEnElLimiteInline() {
        // 16 000 Hz x 2 bytes x 300 s = 9 600 000 bytes en bruto; en base64 ~12,8 MB + prompt < 20 MB.
        long rawFiveMinutes = 16_000L * 2 * 300;
        long base64 = (rawFiveMinutes + 2) / 3 * 4;
        assertTrue(rawFiveMinutes <= MedicalNoteAiService.MAX_INLINE_AUDIO_BYTES);
        assertTrue(rawFiveMinutes <= MedicalNoteAiService.MAX_AUDIO_BYTES);
        assertTrue(base64 + 8_000 < 20L * 1024 * 1024);
    }

    @Test
    void audioVacioSeRechaza() {
        MultipartFile empty = new MockMultipartFile("audio", "a.wav", "audio/wav", new byte[0]);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.draft(empty, historyId, "es"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void falloDeGeminiSeConvierteEnErrorControlado() {
        when(geminiClient.generateRaw(anyMap())).thenThrow(new RuntimeException("HTTP 500"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.draft(wav(), historyId, "es"));
        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertFalse(ex.getReason().contains("500"));
    }

    @Test
    void coincidenciasIgnoranMayusculasYTildes() {
        ClinicalHistory h = ClinicalHistory.builder()
                .allergies(List.of(new AllergyEntry("Ácido acetilsalicílico", null, null)))
                .currentMedications(List.of(new MedicationEntry("ibuprofeno", null, null)))
                .build();

        List<MedicalNoteAiDraftResponse.Warning> warnings = MedicalNoteAiService.findWarnings(
                "El paciente tolera el ACIDO ACETILSALICILICO pero tomó IBUPROFENO.", h);

        assertEquals(2, warnings.size());
    }

    @Test
    void terminosCortosOCoincidenciasParcialesNoGeneranAdvertencia() {
        ClinicalHistory h = ClinicalHistory.builder()
                .allergies(List.of(new AllergyEntry("AS", null, null)))
                .currentMedications(List.of(new MedicationEntry("ibu", null, null)))
                .build();

        assertTrue(MedicalNoteAiService.findWarnings("asma y ibuprofeno", h).isEmpty());
    }

    @Test
    void endpointRequiereMedicalNoteCreate() throws NoSuchMethodException {
        Method m = MedicalNoteController.class.getMethod("aiDraft", MultipartFile.class, UUID.class, String.class, String.class);
        PreAuthorize pre = m.getAnnotation(PreAuthorize.class);

        assertNotNull(pre);
        assertEquals("hasAuthority('medical_note:create')", pre.value());
    }
}
