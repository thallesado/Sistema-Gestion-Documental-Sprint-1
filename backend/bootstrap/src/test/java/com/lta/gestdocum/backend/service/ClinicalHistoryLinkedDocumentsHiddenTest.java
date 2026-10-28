package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository.Row;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.lenient;

/**
 * B2 en GET /clinical-histories/{id}/documents: los documentos vinculados a una historia clínica respetan los
 * componentes ocultos del formulario de documentos igual que el listado de documentos.
 */
@ExtendWith(MockitoExtension.class)
class ClinicalHistoryLinkedDocumentsHiddenTest {

    private static final ComponentFormCatalog.Form FORM = ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM);

    @Mock private ClinicalHistoryRepository repository;
    @Mock private AuthenticatedUserContext userContext;
    @Mock private DocumentRepository documentRepository;
    @Mock private ComponentPermissionService componentPermissions;

    private ClinicalHistoryService service;
    private final UUID tenantId = UUID.randomUUID();
    private final UUID historyId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ClinicalHistoryService(repository, null, userContext, null, null, documentRepository, null, null);
        lenient().when(userContext.requireTenantId()).thenReturn(tenantId);
        lenient().when(repository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId))
                .thenReturn(Optional.of(ClinicalHistory.builder().id(historyId).tenantId(tenantId).build()));
        Document linked = new Document(tenantId, UUID.randomUUID(), UUID.randomUUID(), "DOC-1", "Contrato secreto");
        linked.setId(UUID.randomUUID());
        linked.setDescription("Detalle reservado");
        lenient().when(documentRepository.findLinkedToClinicalHistory(tenantId, historyId)).thenReturn(List.of(linked));
    }

    private static ComponentFormAccess hiding(String... keys) {
        List<Row> rows = java.util.Arrays.stream(keys).map(key -> new Row(10L, key, ComponentState.HIDDEN)).toList();
        return ComponentFormAccess.resolve(FORM, List.of(10L), rows);
    }

    @Test
    @DisplayName("Los documentos vinculados no devuelven nombre, código ni descripción ocultos para el grupo del usuario")
    void hiddenComponentsAreNotReturned() {
        ReflectionTestUtils.setField(service, "componentPermissions", componentPermissions);
        lenient().when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM))
                .thenReturn(hiding("nombre", "codigo", "descripcion"));

        DocumentResponse response = service.getLinkedDocuments(historyId).get(0);

        assertNull(response.name());
        assertNull(response.code());
        assertNull(response.description());
    }

    @Test
    @DisplayName("Sin componentes ocultos el comportamiento previo se mantiene: se devuelven los tres campos")
    void visibleComponentsKeepPreviousBehaviour() {
        ReflectionTestUtils.setField(service, "componentPermissions", componentPermissions);
        lenient().when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM))
                .thenReturn(ComponentFormAccess.unrestricted(FORM));

        DocumentResponse response = service.getLinkedDocuments(historyId).get(0);

        assertEquals("Contrato secreto", response.name());
        assertEquals("DOC-1", response.code());
        assertEquals("Detalle reservado", response.description());
    }
}
