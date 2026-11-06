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
import com.lta.gestdocum.backend.security.HtmlSanitizerService;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicalNoteServiceTest {

    @Mock
    private MedicalNoteRepository repository;

    @Mock
    private ClinicalHistoryRepository historyRepository;

    @Mock
    private AuthenticatedUserContext userContext;

    @Mock
    private HtmlSanitizerService sanitizer;

    @Mock
    private ComponentPermissionService componentPermissions;

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
        lenient().when(historyRepository.findByIdAndTenantIdAndDeletedAtIsNull(nullable(UUID.class), eq(tenantId)))
                .thenReturn(Optional.of(ClinicalHistory.builder().id(historyId).tenantId(tenantId).build()));
        lenient().when(sanitizer.sanitize(anyString())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(componentPermissions.current(ComponentFormCatalog.MEDICAL_NOTE_FORM))
                .thenReturn(ComponentFormAccess.unrestricted(ComponentFormCatalog.require(ComponentFormCatalog.MEDICAL_NOTE_FORM)));
    }

    @Test
    @DisplayName("create() should assign default status DRAFT to newly created medical note")
    void shouldCreateNoteWithDraftStatus() {
        ClinicalHistory history = ClinicalHistory.builder().id(historyId).tenantId(tenantId).build();
        when(historyRepository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(history));

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
    @DisplayName("HU-10: persiste exclusivamente el HTML limpiado por Jsoup")
    void shouldPersistSanitizedHtml() {
        HtmlSanitizerService realSanitizer = new HtmlSanitizerService();
        when(sanitizer.sanitize(anyString())).thenAnswer(inv -> realSanitizer.sanitize(inv.getArgument(0)));
        when(repository.save(any(MedicalNote.class))).thenAnswer(inv -> inv.getArgument(0));
        MedicalNoteResponse response = service.create(new MedicalNoteRequest(historyId, null, "EVOLUTION",
                "<p onload='alert(1)'><strong>Control seguro</strong></p>"
                        + "<script>alert(2)</script><iframe src='x'></iframe><img src='x' onerror='alert(3)'>"));
        ArgumentCaptor<MedicalNote> captor = ArgumentCaptor.forClass(MedicalNote.class);
        verify(repository).save(captor.capture());
        assertEquals("<p><strong>Control seguro</strong></p>", captor.getValue().getContent());
        assertEquals(captor.getValue().getContent(), response.content());
    }

    @Test
    @DisplayName("HU-10: rechaza HTML vacío tras limpieza sin persistir la nota")
    void shouldRejectContentRemovedBySanitization() {
        HtmlSanitizerService realSanitizer = new HtmlSanitizerService();
        when(sanitizer.sanitize(anyString())).thenAnswer(inv -> realSanitizer.sanitize(inv.getArgument(0)));
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.create(
                new MedicalNoteRequest(historyId, null, "EVOLUTION",
                        "<script>alert(1)</script><iframe src='x'></iframe><img src='x' onerror='alert(2)'>")));
        assertTrue(error.getMessage().contains("vacío tras la sanitización"));
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("transition() should allow DRAFT to APPROVED")
    void shouldAllowTransitionFromDraftToApproved() {
        MedicalNote existingNote = MedicalNote.builder()
                .id(noteId)
                .tenantId(tenantId)
                .status(DocumentStatus.DRAFT)
                .build();

        when(repository.findForTransition(noteId, tenantId)).thenReturn(Optional.of(existingNote));
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

        when(repository.findForTransition(noteId, tenantId)).thenReturn(Optional.of(existingNote));
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

        when(repository.findForTransition(noteId, tenantId)).thenReturn(Optional.of(existingNote));

        assertThrows(IllegalStateException.class, () -> service.transition(noteId, DocumentStatus.VOIDED));
        verify(repository, never()).save(any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = DocumentStatus.class, names = {"DRAFT"}, mode = org.junit.jupiter.params.provider.EnumSource.Mode.EXCLUDE)
    void rejectsCreatingAnyNonDraftStatus(DocumentStatus status) {
        when(historyRepository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId))
                .thenReturn(Optional.of(ClinicalHistory.builder().id(historyId).tenantId(tenantId).build()));
        assertThrows(IllegalArgumentException.class, () -> service.create(
                new MedicalNoteRequest(historyId, null, "EVOLUTION", "Nota de prueba", status)));
        verify(repository, never()).save(any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = DocumentStatus.class, names = {"APPROVED", "VOIDED"})
    void rejectsEveryTransitionFromTerminalStates(DocumentStatus current) {
        when(repository.findForTransition(noteId, tenantId)).thenReturn(Optional.of(
                MedicalNote.builder().id(noteId).tenantId(tenantId).status(current).build()));
        for (DocumentStatus target : DocumentStatus.values()) {
            assertThrows(IllegalStateException.class, () -> service.transition(noteId, target));
        }
        verify(repository, never()).save(any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = DocumentStatus.class, names = {"APPROVED", "VOIDED"}, mode = org.junit.jupiter.params.provider.EnumSource.Mode.EXCLUDE)
    void rejectsOtherTargetsFromDraft(DocumentStatus target) {
        when(repository.findForTransition(noteId, tenantId)).thenReturn(Optional.of(
                MedicalNote.builder().id(noteId).tenantId(tenantId).status(DocumentStatus.DRAFT).build()));
        assertThrows(IllegalStateException.class, () -> service.transition(noteId, target));
        verify(repository, never()).save(any());
    }
}
