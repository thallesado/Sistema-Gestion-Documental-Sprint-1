package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.model.DocumentType;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository.Row;
import com.lta.gestdocum.backend.repository.DocumentCategoryRepository;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.DocumentTypeRepository;
import com.lta.gestdocum.backend.repository.ExpedientRepository;
import com.lta.gestdocum.backend.repository.PatientRepository;
import com.lta.gestdocum.backend.repository.TenantDepartmentRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.lta.gestdocum.backend.model.ComponentState.HIDDEN;
import static com.lta.gestdocum.backend.model.ComponentState.VISIBLE_READONLY;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Criterio de aceptación de B2: con codigo = HIDDEN y nombre = VISIBLE_READONLY en el formulario de
 * documentos, el código no se devuelve, el nombre no se puede informar por API y el alta sigue siendo
 * posible porque el servidor asigna ambos valores.
 */
@ExtendWith(MockitoExtension.class)
class DocumentComponentPermissionTest {

    @Mock private DocumentRepository repository;
    @Mock private DocumentTypeRepository documentTypeRepository;
    @Mock private DocumentCategoryRepository categoryRepository;
    @Mock private TenantDepartmentRepository departmentRepository;
    @Mock private UserRepository userRepository;
    @Mock private PatientRepository patientRepository;
    @Mock private ExpedientRepository expedientRepository;
    @Mock private AuthenticatedUserContext userContext;
    @Mock private ComponentPermissionService componentPermissions;

    @InjectMocks
    private DocumentService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(userContext.requireUserId()).thenReturn(userId);
        ComponentFormCatalog.Form form = ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM);
        when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM)).thenReturn(ComponentFormAccess.resolve(
                form, List.of(10L), List.of(new Row(10L, "codigo", HIDDEN), new Row(10L, "nombre", VISIBLE_READONLY))));
    }

    @Test
    @DisplayName("Una llamada directa a la API que informa el nombre de solo lectura se rechaza")
    void readOnlyNameIsRejected() {
        assertThrows(AccessDeniedException.class, () -> service.create(request(null, "Nombre manipulado")));
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("Tampoco se acepta un código oculto enviado por API")
    void hiddenCodeIsRejected() {
        assertThrows(AccessDeniedException.class, () -> service.create(request("DOC-HACK", null)));
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("Sin código ni nombre el servidor los asigna y la respuesta no incluye el código oculto")
    void serverAssignsValuesAndHidesCode() {
        when(documentTypeRepository.findByIdAndTenantId(typeId, tenantId))
                .thenReturn(Optional.of(DocumentType.builder().id(typeId).tenantId(tenantId).name("Contrato").code("CTR").build()));
        when(repository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentResponse response = service.create(request(null, null));

        assertNull(response.code(), "el código oculto no sale del servidor");
        assertEquals("Contrato", response.name(), "el nombre de solo lectura se ve con el valor asignado");
        org.mockito.ArgumentCaptor<Document> saved = org.mockito.ArgumentCaptor.forClass(Document.class);
        verify(repository).save(saved.capture());
        assertTrue(saved.getValue().getCode().startsWith("DOC-"), "el servidor genera el código");
    }

    private DocumentCreateRequest request(String code, String name) {
        return new DocumentCreateRequest(typeId, null, null, null, null, null, null, null,
                code, name, null, null, null, null, null);
    }
}
