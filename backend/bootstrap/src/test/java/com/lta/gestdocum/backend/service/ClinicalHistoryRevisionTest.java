package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.ClinicalHistoryRequest;
import com.lta.gestdocum.backend.dto.ClinicalHistoryResponse;
import com.lta.gestdocum.backend.dto.ClinicalHistoryRevisionResponse;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.ClinicalHistoryRevision;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRevisionRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClinicalHistoryRevisionTest {

    @Mock
    private ClinicalHistoryRepository repository;
    @Mock
    private PatientService patientService;
    @Mock
    private AuthenticatedUserContext userContext;
    @Mock
    private ClinicalHistoryRevisionRepository revisionRepository;
    @Mock
    private UserRepository userRepository;

    private ClinicalHistoryService service;
    private final UUID tenantId = UUID.randomUUID();
    private final UUID historyId = UUID.randomUUID();
    private final UUID patientId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ClinicalHistoryService(
                repository,
                patientService,
                userContext,
                null,
                null,
                null,
                null,
                null,
                revisionRepository,
                userRepository,
                null,
                new ObjectMapper().findAndRegisterModules()
        );
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(userContext.requireUserId()).thenReturn(userId);
    }

    @Test
    @DisplayName("Should create revision snapshot and increment revision number on update")
    void testUpdateCreatesRevisionWithSnapshot() {
        ClinicalHistory history = ClinicalHistory.builder()
                .id(historyId)
                .tenantId(tenantId)
                .patientId(patientId)
                .code("HC-1001")
                .bloodType("O+")
                .observations("Observación inicial")
                .allergies(new ArrayList<>())
                .currentMedications(new ArrayList<>())
                .baseDiagnoses(new ArrayList<>())
                .createdAt(OffsetDateTime.now().minusDays(2))
                .updatedAt(OffsetDateTime.now().minusDays(2))
                .build();

        Patient patient = Patient.builder().id(patientId).tenantId(tenantId).firstName("Juan").lastName("Perez").build();

        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));
        when(patientService.requireByIdAndTenant(patientId, tenantId)).thenReturn(patient);
        when(revisionRepository.countByTenantIdAndClinicalHistoryId(tenantId, historyId)).thenReturn(0L);
        when(repository.save(any(ClinicalHistory.class))).thenAnswer(i -> i.getArgument(0));

        ClinicalHistoryRequest updateReq = new ClinicalHistoryRequest();
        updateReq.setPatientId(patientId);
        updateReq.setObservations("Observación actualizada");

        ClinicalHistoryResponse res = service.update(historyId, updateReq);

        assertThat(res).isNotNull();
        ArgumentCaptor<ClinicalHistoryRevision> revisionCaptor = ArgumentCaptor.forClass(ClinicalHistoryRevision.class);
        verify(revisionRepository, times(1)).save(revisionCaptor.capture());

        ClinicalHistoryRevision savedRevision = revisionCaptor.getValue();
        assertThat(savedRevision.getRevisionNumber()).isEqualTo(1);
        assertThat(savedRevision.getTenantId()).isEqualTo(tenantId);
        assertThat(savedRevision.getClinicalHistoryId()).isEqualTo(historyId);
        assertThat(savedRevision.getAuthorId()).isEqualTo(userId);
        assertThat(savedRevision.getChangeSummary()).contains("observations");
        assertThat(savedRevision.getSnapshotData()).contains("Observación inicial");
    }

    @Test
    @DisplayName("Should increment revision number to 2 when previous revisions exist")
    void testSecondUpdateIncrementsRevisionNumber() {
        ClinicalHistory history = ClinicalHistory.builder()
                .id(historyId)
                .tenantId(tenantId)
                .patientId(patientId)
                .code("HC-1001")
                .bloodType("A+")
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        Patient patient = Patient.builder().id(patientId).tenantId(tenantId).firstName("Ana").lastName("Gomez").build();

        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));
        when(patientService.requireByIdAndTenant(patientId, tenantId)).thenReturn(patient);
        when(revisionRepository.countByTenantIdAndClinicalHistoryId(tenantId, historyId)).thenReturn(1L);
        when(repository.save(any(ClinicalHistory.class))).thenAnswer(i -> i.getArgument(0));

        ClinicalHistoryRequest updateReq = new ClinicalHistoryRequest();
        updateReq.setPatientId(patientId);
        updateReq.setBloodType("B+");

        service.update(historyId, updateReq);

        ArgumentCaptor<ClinicalHistoryRevision> captor = ArgumentCaptor.forClass(ClinicalHistoryRevision.class);
        verify(revisionRepository).save(captor.capture());
        assertThat(captor.getValue().getRevisionNumber()).isEqualTo(2);
    }

    @Test
    @DisplayName("Should return ordered revision list with author details")
    void testGetRevisionsReturnsOrderedList() {
        ClinicalHistory history = ClinicalHistory.builder().id(historyId).tenantId(tenantId).patientId(patientId).build();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));

        ClinicalHistoryRevision rev1 = ClinicalHistoryRevision.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .clinicalHistoryId(historyId)
                .revisionNumber(2)
                .authorId(userId)
                .createdAt(OffsetDateTime.now())
                .changeSummary("Campos modificados: observations")
                .snapshotData("{\"observations\":\"Previo\"}")
                .build();

        when(revisionRepository.findByTenantIdAndClinicalHistoryIdOrderByRevisionNumberDesc(tenantId, historyId))
                .thenReturn(List.of(rev1));

        User user = User.builder().id(userId).firstName("Dr. Carlos").lastName("Medico").build();
        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));

        List<ClinicalHistoryRevisionResponse> result = service.getRevisions(historyId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).revisionNumber()).isEqualTo(2);
        assertThat(result.get(0).authorName()).isEqualTo("Dr. Carlos Medico");
        assertThat(result.get(0).changeSummary()).isEqualTo("Campos modificados: observations");
    }
}
