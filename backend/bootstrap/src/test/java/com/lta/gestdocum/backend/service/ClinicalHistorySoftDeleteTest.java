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

        when(clinicalDocumentLinkRepository.existsByTenantIdAndClinicalHistoryIdAndIdDocumentId(tenantId, historyId, documentId)).thenReturn(true);
        service.unlinkDocument(historyId, documentId);

        verify(clinicalDocumentLinkRepository).deleteByTenantIdAndClinicalHistoryIdAndIdDocumentId(tenantId, historyId, documentId);
    }

    @Test
    void auditReasonPreservesQuotesBackslashesAndNewlines() throws Exception {
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId))
                .thenReturn(Optional.of(ClinicalHistory.builder().id(historyId).tenantId(tenantId).build()));
        String reason = "Corrección administrativa: \"duplicado\"\nReferencia C:\\archivo\\registro";
        service.delete(historyId, new DeleteClinicalHistoryRequest(reason));
        ArgumentCaptor<AuditEvent> audit = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditEventRepository).save(audit.capture());
        assertEquals(reason, new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(audit.getValue().getDetails()).get("reason").asText());
    }

    @Test
    void rejectsReasonLongerThan500WithoutWriting() {
        assertThrows(IllegalArgumentException.class, () -> service.delete(historyId,
                new DeleteClinicalHistoryRequest("x".repeat(501))));
        verifyNoInteractions(repository, auditEventRepository);
    }

    @Test
    void rejectsDocumentAssignedToAnotherPatient() {
        UUID documentId = UUID.randomUUID();
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(
                ClinicalHistory.builder().id(historyId).tenantId(tenantId).patientId(UUID.randomUUID()).build()));
        var document = new com.lta.gestdocum.backend.model.Document(tenantId, UUID.randomUUID(), userId, "DOC", "Prueba");
        document.setPatientId(UUID.randomUUID());
        when(documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenantId)).thenReturn(Optional.of(document));
        assertThrows(IllegalArgumentException.class, () -> service.linkDocument(historyId, documentId));
        verifyNoInteractions(clinicalDocumentLinkRepository, auditEventRepository);
    }

    @Test
    void alreadyDeletedHistoryCannotBeLinked() {
        when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.linkDocument(historyId, UUID.randomUUID()));
        verifyNoInteractions(documentRepository, clinicalDocumentLinkRepository, auditEventRepository);
    }

    @Test
    void exposesDeletionEvidenceForThePatientsTenant() {
        UUID patientId = UUID.randomUUID();
        var deletedAt = java.time.OffsetDateTime.now();
        when(repository.findByTenantIdAndPatientId(tenantId, patientId)).thenReturn(Optional.of(
                ClinicalHistory.builder().id(historyId).tenantId(tenantId).patientId(patientId)
                        .code("HC-DELETED").deletedAt(deletedAt).deletionReason("Duplicado confirmado")
                        .deletedBy(userId).build()));
        var evidence = service.findDeletion(patientId);
        assertEquals(historyId, evidence.id());
        assertEquals("Duplicado confirmado", evidence.reason());
        assertEquals(deletedAt, evidence.deletedAt());
        assertEquals(userId, evidence.deletedBy());
        verify(patientService).requireByIdAndTenant(patientId, tenantId);
    }

    @Test
    void activeHistoryHasNoDeletionEvidence() {
        UUID patientId = UUID.randomUUID();
        when(repository.findByTenantIdAndPatientId(tenantId, patientId)).thenReturn(Optional.of(
                ClinicalHistory.builder().id(historyId).tenantId(tenantId).patientId(patientId).build()));
        assertNull(service.findDeletion(patientId));
    }
}
