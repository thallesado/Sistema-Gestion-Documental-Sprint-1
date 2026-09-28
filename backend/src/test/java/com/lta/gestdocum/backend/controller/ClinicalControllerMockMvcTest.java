package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ClinicalHistoryResponse;
import com.lta.gestdocum.backend.dto.TimelineEventResponse;
import com.lta.gestdocum.backend.dto.ExpedientResponse;
import com.lta.gestdocum.backend.service.ClinicalHistoryService;
import com.lta.gestdocum.backend.service.ExpedientService;
import com.lta.gestdocum.backend.service.PatientService;
import com.lta.gestdocum.backend.model.Expedient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ClinicalControllerMockMvcTest {

    @Mock
    private ClinicalHistoryService clinicalHistoryService;
    @Mock
    private PatientService patientService;
    @Mock
    private ExpedientService expedientService;

    private MockMvc clinicalMockMvc;
    private MockMvc patientMockMvc;
    private MockMvc expedientMockMvc;

    @BeforeEach
    void setUp() {
        clinicalMockMvc = MockMvcBuilders.standaloneSetup(new ClinicalHistoryController(clinicalHistoryService))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
        patientMockMvc = MockMvcBuilders.standaloneSetup(new PatientController(patientService))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
        expedientMockMvc = MockMvcBuilders.standaloneSetup(new ExpedientController(expedientService))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
    }

    @Test
    void listsClinicalHistoriesWithFilterAndPageable() throws Exception {
        UUID patientId = UUID.randomUUID();
        when(clinicalHistoryService.find(isNull(), isNull(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(
                        List.of(ClinicalHistoryResponse.builder()
                                .id(UUID.randomUUID())
                                .code("HC-ABC123")
                                .patientId(patientId)
                                .patientLabel("Paciente Demostración")
                                .build()),
                        PageRequest.of(0, 5),
                        1));

        clinicalMockMvc.perform(get("/api/v1/clinical-histories")
                        .param("page", "0")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].code").value("HC-ABC123"))
                .andExpect(jsonPath("$.content[0].patientLabel").value("Paciente Demostración"));
    }

    @Test
    void exposesPatientReadPermissionOnClinicalHistoryList() throws NoSuchMethodException {
        PreAuthorize annotation = ClinicalHistoryController.class
                .getDeclaredMethod("find", UUID.class, String.class, Pageable.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAuthority('patient:read')", annotation.value());
    }

    @Test
    void exposesPatientCreatePermissionOnClinicalHistoryCreate() throws NoSuchMethodException {
        PreAuthorize annotation = ClinicalHistoryController.class
                .getDeclaredMethod("create", com.lta.gestdocum.backend.dto.ClinicalHistoryRequest.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAuthority('patient:create')", annotation.value());
    }

    @Test
    void exposesPatientUpdatePermissionOnClinicalHistoryUpdate() throws NoSuchMethodException {
        PreAuthorize annotation = ClinicalHistoryController.class
                .getDeclaredMethod("update", UUID.class, com.lta.gestdocum.backend.dto.ClinicalHistoryRequest.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAuthority('patient:update')", annotation.value());
    }

    @Test
    void createIsMappedToPostWithStructuredCapture() throws Exception {
        UUID patientId = UUID.randomUUID();
        when(clinicalHistoryService.create(any())).thenReturn(ClinicalHistoryResponse.builder()
                .id(UUID.randomUUID())
                .code("HC-NEW123")
                .patientId(patientId)
                .build());

        clinicalMockMvc.perform(post("/api/v1/clinical-histories")
                        .contentType("application/json")
                        .content("""
                                {
                                  "patientId": "%s",
                                  "bloodType": "A+",
                                  "pathologicalAntecedents": "HTA",
                                  "allergies": [{"allergen": "Penicilina", "severity": "HIGH", "reaction": "Erupción"}],
                                  "currentMedications": [{"name": "Losartán", "dose": "50 mg"}]
                                }
                                """.formatted(patientId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("HC-NEW123"));
    }

    @Test
    void exposesPatientReadPermissionOnPatientList() throws NoSuchMethodException {
        PreAuthorize annotation = PatientController.class
                .getDeclaredMethod("find", String.class, Pageable.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAuthority('patient:read')", annotation.value());
    }

    @Test
    void timelineIsExposedAsChronologicalReadEndpoint() throws Exception {
        UUID historyId = UUID.randomUUID();
        when(clinicalHistoryService.timeline(historyId)).thenReturn(List.of(
                TimelineEventResponse.builder().occurredAt(java.time.OffsetDateTime.now())
                        .eventType("CLINICAL_HISTORY_OPENED").code("HC-1").build()));

        clinicalMockMvc.perform(get("/api/v1/clinical-histories/{id}/timeline", historyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").value("CLINICAL_HISTORY_OPENED"))
                .andExpect(jsonPath("$[0].code").value("HC-1"));
    }

    @Test
    void listsTenantExpedientsThroughTheReadContract() throws Exception {
        when(expedientService.find(isNull(), any(Pageable.class))).thenReturn(new PageImpl<>(
                List.of(new ExpedientResponse(
                        UUID.randomUUID(), UUID.randomUUID(), null, null, "HC-1001",
                        "Expediente clínico", "Demostración", Expedient.ExpedientStatus.ACTIVE,
                        java.util.Map.of(), null, null, java.time.OffsetDateTime.now(),
                        java.time.OffsetDateTime.now())),
                PageRequest.of(0, 20), 1));

        expedientMockMvc.perform(get("/api/v1/expedients").param("page", "0").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].code").value("HC-1001"))
                .andExpect(jsonPath("$.content[0].status").value("ACTIVE"));
    }

    @Test
    void exposesExpedientReadPermission() throws NoSuchMethodException {
        PreAuthorize annotation = ExpedientController.class
                .getDeclaredMethod("find", String.class, Pageable.class)
                .getAnnotation(PreAuthorize.class);

        assertEquals("hasAuthority('expedient:read')", annotation.value());
    }
}