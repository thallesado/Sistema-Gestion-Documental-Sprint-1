package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.TimelineEventResponse;
import com.lta.gestdocum.backend.model.*;
import com.lta.gestdocum.backend.repository.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClinicalHistoryTimelineSearchTest {

    @Mock
    private ClinicalHistoryRepository repository;
    @Mock
    private AuthenticatedUserContext userContext;
    @Mock
    private ClinicalEpisodeRepository episodeRepository;
    @Mock
    private MedicalNoteRepository medicalNoteRepository;
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private ClinicalStaffRepository clinicalStaffRepository;

    private ClinicalHistoryService service;
    private final UUID tenantId = UUID.randomUUID();
    private final UUID historyId = UUID.randomUUID();
    private final UUID doctorId = UUID.randomUUID();
    private final UUID episode1Id = UUID.randomUUID();

    private final OffsetDateTime t0 = OffsetDateTime.parse("2026-01-01T10:00:00Z");
    private final OffsetDateTime t1 = OffsetDateTime.parse("2026-02-01T10:00:00Z");
    private final OffsetDateTime t2 = OffsetDateTime.parse("2026-03-01T10:00:00Z");

    @BeforeEach
    void setUp() {
        service = new ClinicalHistoryService(
                repository,
                null,
                userContext,
                episodeRepository,
                medicalNoteRepository,
                documentRepository,
                null,
                null,
                null,
                null,
                clinicalStaffRepository,
                null
        );
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);

        ClinicalHistory history = ClinicalHistory.builder()
                .id(historyId)
                .tenantId(tenantId)
                .code("HC-001")
                .createdAt(t0)
                .build();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));

        ClinicalEpisode episode = ClinicalEpisode.builder()
                .id(episode1Id)
                .tenantId(tenantId)
                .clinicalHistoryId(historyId)
                .code("EP-01")
                .episodeType("CONSULTA_EXTERNA")
                .status("ACTIVO")
                .startedAt(t1)
                .build();
        when(episodeRepository.findByTenantIdAndClinicalHistoryIdOrderByStartedAtDesc(tenantId, historyId))
                .thenReturn(List.of(episode));

        MedicalNote note = MedicalNote.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .clinicalHistoryId(historyId)
                .episodeId(episode1Id)
                .authorId(doctorId)
                .noteType("EVOLUTION")
                .content("Paciente estable")
                .createdAt(t2)
                .build();
        when(medicalNoteRepository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(tenantId, historyId))
                .thenReturn(List.of(note));

        User doctorUser = User.builder().id(doctorId).tenantId(tenantId).firstName("Carlos").lastName("Gomez").build();
        ClinicalStaff staff = ClinicalStaff.builder()
                .user(doctorUser)
                .tenantId(tenantId)
                .specialty("Cardiología")
                .build();
        lenient().when(clinicalStaffRepository.findByUserIdAndTenantId(doctorId, tenantId))
                .thenReturn(Optional.of(staff));

        lenient().when(documentRepository.findLinkedToClinicalHistory(tenantId, historyId))
                .thenReturn(List.of());
    }

    @Test
    @DisplayName("Should return all timeline events when filters are null")
    void testTimelineWithoutFilters() {
        List<TimelineEventResponse> result = service.timeline(historyId);

        assertThat(result).hasSize(3);
        assertThat(result.get(0).getEventType()).isEqualTo("MEDICAL_NOTE");
        assertThat(result.get(1).getEventType()).isEqualTo("EPISODE");
        assertThat(result.get(2).getEventType()).isEqualTo("CLINICAL_HISTORY_OPENED");
    }

    @Test
    @DisplayName("Should filter timeline events by date range")
    void testFilterByDateRange() {
        OffsetDateTime from = OffsetDateTime.parse("2026-01-15T00:00:00Z");
        OffsetDateTime to = OffsetDateTime.parse("2026-02-15T00:00:00Z");

        List<TimelineEventResponse> result = service.timeline(historyId, from, to, null, null, null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getEventType()).isEqualTo("EPISODE");
    }

    @Test
    @DisplayName("Should filter timeline events by event type")
    void testFilterByEventType() {
        List<TimelineEventResponse> result = service.timeline(historyId, null, null, "MEDICAL_NOTE", null, null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getEventType()).isEqualTo("MEDICAL_NOTE");
        assertThat(result.get(0).getCode()).isEqualTo("EVOLUTION");
    }

    @Test
    @DisplayName("Should filter timeline events by specialty")
    void testFilterBySpecialty() {
        List<TimelineEventResponse> result = service.timeline(historyId, null, null, null, null, "Cardiología", null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getSpecialty()).isEqualTo("Cardiología");
    }

    @Test
    @DisplayName("Should filter timeline events by professionalId")
    void testFilterByProfessionalId() {
        List<TimelineEventResponse> result = service.timeline(historyId, null, null, null, doctorId, null, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getProfessionalId()).isEqualTo(doctorId);
    }
}
