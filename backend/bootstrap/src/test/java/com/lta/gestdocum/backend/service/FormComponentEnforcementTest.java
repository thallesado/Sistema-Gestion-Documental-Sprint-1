package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.MedicalNoteRequest;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.Document.DocumentStatus;
import com.lta.gestdocum.backend.model.MedicalNote;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository.Row;
import com.lta.gestdocum.backend.repository.MedicalNoteRepository;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.security.HtmlSanitizerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.lta.gestdocum.backend.model.ComponentState.HIDDEN;
import static com.lta.gestdocum.backend.model.ComponentState.VISIBLE_READONLY;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Aplicación en el servidor de los privilegios por componente en usuarios y notas médicas. */
@ExtendWith(MockitoExtension.class)
class FormComponentEnforcementTest {

    @Mock private ComponentPermissionService componentPermissions;
    @Mock private RoleRepository roleRepository;
    @Mock private MedicalNoteRepository noteRepository;
    @Mock private ClinicalHistoryRepository historyRepository;
    @Mock private AuthenticatedUserContext userContext;
    @Mock private HtmlSanitizerService sanitizer;

    private final UUID tenantId = UUID.randomUUID();

    private ComponentFormAccess access(String formKey, Row... rows) {
        return ComponentFormAccess.resolve(ComponentFormCatalog.require(formKey), List.of(5L), List.of(rows));
    }

    @Test
    @DisplayName("Usuarios: cambiar un correo de solo lectura se rechaza; enviarlo sin cambios se acepta")
    void userReadOnlyEmail() {
        when(componentPermissions.current(ComponentFormCatalog.USER_FORM))
                .thenReturn(access(ComponentFormCatalog.USER_FORM, new Row(5L, "correo", VISIBLE_READONLY)));
        UserFormPolicy policy = new UserFormPolicy(componentPermissions, roleRepository);
        User current = User.builder().id(UUID.randomUUID()).tenantId(tenantId).username("ana")
                .firstName("Ana").lastName("Prueba").email("ana@example.test").status(UserStatus.ACTIVE).build();

        UserUpdateRequest unchanged = update("ana@example.test");
        assertDoesNotThrow(() -> policy.validateUpdate(current, unchanged));
        assertThrows(AccessDeniedException.class, () -> policy.validateUpdate(current, update("otro@example.test")));
    }

    @Test
    @DisplayName("Notas: con estado de solo lectura no se firma una nota ni se crea como vigente")
    void noteReadOnlyStatus() {
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(userContext.requireUserId()).thenReturn(UUID.randomUUID());
        when(componentPermissions.current(ComponentFormCatalog.MEDICAL_NOTE_FORM))
                .thenReturn(access(ComponentFormCatalog.MEDICAL_NOTE_FORM, new Row(5L, "estado", VISIBLE_READONLY)));
        MedicalNoteService service = new MedicalNoteService(noteRepository, historyRepository, userContext, sanitizer,
                componentPermissions);
        UUID historyId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        lenient().when(historyRepository.findByIdAndTenantId(historyId, tenantId)).thenReturn(Optional.of(new ClinicalHistory()));
        when(noteRepository.findByIdAndTenantId(noteId, tenantId)).thenReturn(Optional.of(MedicalNote.builder()
                .id(noteId).tenantId(tenantId).status(DocumentStatus.DRAFT).build()));

        assertThrows(AccessDeniedException.class, () -> service.transition(noteId, DocumentStatus.APPROVED));
        assertThrows(AccessDeniedException.class, () -> service.create(
                new MedicalNoteRequest(historyId, null, "EVOLUTION", "<p>texto</p>", DocumentStatus.APPROVED)));
        verify(noteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Notas: el contenido oculto no se devuelve y el tipo bloqueado queda en EVOLUTION")
    void noteHiddenContentAndFixedType() {
        when(userContext.requireTenantId()).thenReturn(tenantId);
        when(userContext.requireUserId()).thenReturn(UUID.randomUUID());
        when(sanitizer.sanitize(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(componentPermissions.current(ComponentFormCatalog.MEDICAL_NOTE_FORM))
                .thenReturn(access(ComponentFormCatalog.MEDICAL_NOTE_FORM,
                        new Row(5L, "tipo", VISIBLE_READONLY), new Row(5L, "contenido", VISIBLE_READONLY)));
        UUID historyId = UUID.randomUUID();
        when(historyRepository.findByIdAndTenantId(historyId, tenantId)).thenReturn(Optional.of(new ClinicalHistory()));
        MedicalNoteService service = new MedicalNoteService(noteRepository, historyRepository, userContext, sanitizer,
                componentPermissions);

        assertThrows(AccessDeniedException.class, () -> service.create(
                new MedicalNoteRequest(historyId, null, "PRESCRIPTION", "<p>texto</p>", null)));
        assertThrows(AccessDeniedException.class, () -> service.create(
                new MedicalNoteRequest(historyId, null, "EVOLUTION", "<p>texto</p>", null)),
                "el contenido de solo lectura no se puede escribir");

        when(componentPermissions.current(ComponentFormCatalog.MEDICAL_NOTE_FORM))
                .thenReturn(access(ComponentFormCatalog.MEDICAL_NOTE_FORM, new Row(5L, "tipo", VISIBLE_READONLY),
                        new Row(5L, "estado", HIDDEN)));
        when(noteRepository.save(any(MedicalNote.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var created = service.create(new MedicalNoteRequest(historyId, null, "evolution", "<p>texto</p>", null));
        assertEquals("EVOLUTION", created.noteType());
        assertNull(created.status(), "el estado oculto no se devuelve");
    }

    private UserUpdateRequest update(String email) {
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFirstName("Ana");
        request.setLastName("Prueba");
        request.setEmail(email);
        return request;
    }
}
