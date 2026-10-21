package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DeleteClinicalHistoryRequest;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.repository.*;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClinicalHistorySoftDeleteTest {

    @Mock
    private ClinicalHistoryRepository repository;

    @Mock
    private AuditEventRepository auditEventRepository;

    @Mock
    private AuthenticatedUserContext userContext;

    @Mock
    private PatientService patientService;

    @Mock
    private ClinicalEpisodeRepository episodeRepository;

    @Mock
    private MedicalNoteRepository medicalNoteRepository;

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private ClinicalDocumentLinkRepository clinicalDocumentLinkRepository;

    @InjectMocks
    private ClinicalHistoryService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID historyId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(userContext.requireUserId()).thenReturn(userId);
    }

    @Test
    @DisplayName("delete() should perform soft delete with mandatory justification and record audit event")
    void shouldPerformSoftDeleteWithJustificationAndAudit() {
        ClinicalHistory history = ClinicalHistory.builder()
                .id(historyId)
                .tenantId(tenantId)
                .code("HC-0001")
                .build();

        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));
        when(repository.save(any(ClinicalHistory.class))).thenAnswer(inv -> inv.getArgument(0));

        DeleteClinicalHistoryRequest request = new DeleteClinicalHistoryRequest("Duplicado por error administrativo en admisión");
        service.delete(historyId, request);

        ArgumentCaptor<ClinicalHistory> historyCaptor = ArgumentCaptor.forClass(ClinicalHistory.class);
        verify(repository).save(historyCaptor.capture());
        ClinicalHistory savedHistory = historyCaptor.getValue();

        assertNotNull(savedHistory.getDeletedAt(), "deletedAt no debe ser nulo tras la baja lógica");
        assertEquals("Duplicado por error administrativo en admisión", savedHistory.getDeletionReason());
        assertEquals(userId, savedHistory.getDeletedBy());

        ArgumentCaptor<AuditEvent> auditCaptor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditEventRepository).save(auditCaptor.capture());
        AuditEvent event = auditCaptor.getValue();

        assertEquals("CLINICAL_HISTORY_DELETED", event.getAction());
        assertEquals("clinical_history", event.getEntityType());
        assertEquals(historyId, event.getEntityId());
        assertTrue(event.getDetails().contains("Duplicado por error administrativo"));
    }

    @Test
    @DisplayName("delete() should throw NotFoundException when history does not exist or is already deleted")
    void shouldThrowNotFoundWhenAlreadyDeletedOrNotFound() {
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.empty());

        DeleteClinicalHistoryRequest request = new DeleteClinicalHistoryRequest("Motivo de baja clínica justificado");
        assertThrows(NotFoundException.class, () -> service.delete(historyId, request));

        verify(repository, never()).save(any());
        verify(auditEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete() should reject deletion when justification reason is blank or too short")
    void shouldRejectWhenReasonIsTooShort() {
        assertThrows(IllegalArgumentException.class, () ->
                service.delete(historyId, new DeleteClinicalHistoryRequest("corto")));

        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("linkDocument() should link document to clinical history and patient")
    void shouldLinkDocumentToClinicalHistory() {
        UUID documentId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        ClinicalHistory history = ClinicalHistory.builder()
                .id(historyId)
                .tenantId(tenantId)
                .patientId(patientId)
                .build();
        com.lta.gestdocum.backend.model.Document doc = new com.lta.gestdocum.backend.model.Document(
                tenantId, UUID.randomUUID(), userId, "DOC-001", "Hemograma Completo");
        doc.setId(documentId);

        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));
        when(documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId)).thenReturn(Optional.of(doc));
        when(clinicalDocumentLinkRepository.existsByTenantIdAndClinicalHistoryIdAndIdDocumentId(tenantId, historyId, documentId))
                .thenReturn(false);

        var response = service.linkDocument(historyId, documentId);

        assertNotNull(response);
        assertEquals(documentId, response.id());
        assertEquals("Hemograma Completo", response.name());
        verify(clinicalDocumentLinkRepository).save(any(com.lta.gestdocum.backend.model.ClinicalDocumentLink.class));
    }

    @Test
    @DisplayName("unlinkDocument() should remove link between document and clinical history")
    void shouldUnlinkDocument() {
        UUID documentId = UUID.randomUUID();
        ClinicalHistory history = ClinicalHistory.builder().id(historyId).tenantId(tenantId).build();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));

        service.unlinkDocument(historyId, documentId);

        verify(clinicalDocumentLinkRepository).deleteByTenantIdAndClinicalHistoryIdAndIdDocumentId(tenantId, historyId, documentId);
    }
}
