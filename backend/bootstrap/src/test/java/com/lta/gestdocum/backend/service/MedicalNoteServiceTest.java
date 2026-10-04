package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.MedicalNoteRequest;
import com.lta.gestdocum.backend.dto.MedicalNoteResponse;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import com.lta.gestdocum.backend.model.MedicalNote;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.MedicalNoteRepository;
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
class MedicalNoteServiceTest {

    @Mock
    private MedicalNoteRepository repository;

    @Mock
    private ClinicalHistoryRepository historyRepository;

    @Mock
    private AuthenticatedUserContext userContext;

    @InjectMocks
    private MedicalNoteService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID historyId = UUID.randomUUID();
    private final UUID noteId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(userContext.requireUserId()).thenReturn(userId);
    }

    @Test
    @DisplayName("create() should assign default status DRAFT to newly created medical note")
    void shouldCreateNoteWithDraftStatus() {
        ClinicalHistory history = ClinicalHistory.builder().id(historyId).tenantId(tenantId).build();
        when(historyRepository.findByIdAndTenantId(historyId, tenantId)).thenReturn(Optional.of(history));

        MedicalNoteRequest request = new MedicalNoteRequest(historyId, null, "EVOLUTION", "Nota clínica de prueba");
        
        when(repository.save(any(MedicalNote.class))).thenAnswer(invocation -> {
            MedicalNote note = invocation.getArgument(0);
            return note;
        });

        MedicalNoteResponse response = service.create(request);

        ArgumentCaptor<MedicalNote> captor = ArgumentCaptor.forClass(MedicalNote.class);
        verify(repository).save(captor.capture());
        MedicalNote savedNote = captor.getValue();

        assertEquals(DocumentStatus.DRAFT, savedNote.getStatus(), "La nota debe persistirse con estado DRAFT por defecto");
        assertEquals(DocumentStatus.DRAFT, response.status(), "El response debe exponer el estado DRAFT");
    }

    @Test
    @DisplayName("transition() should allow DRAFT to APPROVED")
    void shouldAllowTransitionFromDraftToApproved() {
        MedicalNote existingNote = MedicalNote.builder()
                .id(noteId)
                .tenantId(tenantId)
                .status(DocumentStatus.DRAFT)
                .build();

        when(repository.findByIdAndTenantId(noteId, tenantId)).thenReturn(Optional.of(existingNote));
        when(repository.save(any(MedicalNote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MedicalNoteResponse response = service.transition(noteId, DocumentStatus.APPROVED);

        assertEquals(DocumentStatus.APPROVED, response.status());
        verify(repository).save(existingNote);
    }

    @Test
    @DisplayName("transition() should allow DRAFT to VOIDED")
    void shouldAllowTransitionFromDraftToVoided() {
        MedicalNote existingNote = MedicalNote.builder()
                .id(noteId)
                .tenantId(tenantId)
                .status(DocumentStatus.DRAFT)
                .build();

        when(repository.findByIdAndTenantId(noteId, tenantId)).thenReturn(Optional.of(existingNote));
        when(repository.save(any(MedicalNote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MedicalNoteResponse response = service.transition(noteId, DocumentStatus.VOIDED);

        assertEquals(DocumentStatus.VOIDED, response.status());
        verify(repository).save(existingNote);
    }

    @Test
    @DisplayName("transition() should reject transition from APPROVED to any other status")
    void shouldRejectTransitionFromApproved() {
        MedicalNote existingNote = MedicalNote.builder()
                .id(noteId)
                .tenantId(tenantId)
                .status(DocumentStatus.APPROVED)
                .build();

        when(repository.findByIdAndTenantId(noteId, tenantId)).thenReturn(Optional.of(existingNote));

        assertThrows(IllegalStateException.class, () -> service.transition(noteId, DocumentStatus.VOIDED));
        verify(repository, never()).save(any());
    }
}
