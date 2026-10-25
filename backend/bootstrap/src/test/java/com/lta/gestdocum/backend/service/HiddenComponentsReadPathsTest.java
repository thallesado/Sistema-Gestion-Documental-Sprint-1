package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.DocumentDTO;
import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository.Row;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B2 en las vías de lectura que no son el listado de documentos: un componente oculto para los grupos
 * del usuario no sale por la metadata, la búsqueda ni las vistas de workflow, y sigue saliendo para
 * quien no lo tiene oculto (gana el grupo más permisivo; sin configuración todo es visible).
 */
@ExtendWith(MockitoExtension.class)
class HiddenComponentsReadPathsTest {

    private static final ComponentFormCatalog.Form FORM = ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM);

    @Mock private ComponentPermissionService componentPermissions;
    @Mock private AuthenticatedUserContext context;
    @Mock private DocumentRepository documentRepository;
    @Mock private NamedParameterJdbcTemplate jdbc;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(context.requireTenantId()).thenReturn(tenantId);
        lenient().when(context.requireUserId()).thenReturn(UUID.randomUUID());
        lenient().when(context.hasAuthority(anyString())).thenReturn(true);
    }

    private static ComponentFormAccess hiding(String... keys) {
        List<Row> rows = java.util.Arrays.stream(keys).map(key -> new Row(10L, key, ComponentState.HIDDEN)).toList();
        return ComponentFormAccess.resolve(FORM, List.of(10L), rows);
    }

    private void actingAs(ComponentFormAccess access) {
        lenient().when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM)).thenReturn(access);
    }

    // ---- Metadata del documento (OCR) -------------------------------------------------------------

    private Map<String, Object> ocrMetadata() {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("source", "OCR");
        metadata.put("patientName", "Ana Pérez");
        metadata.put("patientDocumentNumber", "1234567");
        metadata.put("doctorName", "Dr. Gómez");
        metadata.put("issueDate", "2026-01-02");
        return metadata;
    }

    @Test
    @DisplayName("La metadata no devuelve datos del paciente, médico ni emisión cuando esos componentes están ocultos")
    void metadataFollowsHiddenComponents() {
        Map<String, Object> visible = DocumentService.hideMetadata(hiding("paciente", "responsable", "emision"), ocrMetadata());
        assertEquals(Map.of("source", "OCR"), visible);
    }

    @Test
    @DisplayName("Con componentes visibles (o sin configuración) la metadata se devuelve completa")
    void metadataUnchangedWhenVisible() {
        assertEquals(ocrMetadata(), DocumentService.hideMetadata(ComponentFormAccess.unrestricted(FORM), ocrMetadata()));
        assertNull(DocumentService.hideMetadata(hiding("paciente"), null));
    }

    @Test
    @DisplayName("Un usuario en dos grupos, uno que oculta y otro sin configuración, ve la metadata del paciente")
    void mostPermissiveGroupWinsOnMetadata() {
        ComponentFormAccess access = ComponentFormAccess.resolve(FORM, List.of(10L, 11L),
                List.of(new Row(10L, "paciente", ComponentState.HIDDEN)));
        assertTrue(DocumentService.hideMetadata(access, ocrMetadata()).containsKey("patientName"));
    }

    // ---- Búsqueda de documentos -------------------------------------------------------------------

    @Test
    @DisplayName("La búsqueda no devuelve código ni descripción ocultos y sí los devuelve a quien los ve")
    void searchHidesCodeAndDescription() {
        Document document = new Document(tenantId, UUID.randomUUID(), UUID.randomUUID(), "DOC-1", "Informe");
        document.setId(UUID.randomUUID());
        document.setDescription("Resumen confidencial");
        when(documentRepository.findByTenantIdAndNameContainingIgnoreCase(tenantId, "inf")).thenReturn(List.of(document));
        DocumentSearchService search = new DocumentSearchService(documentRepository, context, componentPermissions);

        actingAs(hiding("descripcion", "codigo"));
        DocumentDTO hidden = search.searchDocumentsByTenant("inf", 5).get(0);
        assertNull(hidden.getDescription());
        assertNull(hidden.getDocumentNumber());
        assertEquals("Informe", hidden.getTitle());

        actingAs(ComponentFormAccess.unrestricted(FORM));
        DocumentDTO shown = search.searchDocumentsByTenant("inf", 5).get(0);
        assertEquals("Resumen confidencial", shown.getDescription());
        assertEquals("DOC-1", shown.getDocumentNumber());
    }

    @Test
    @DisplayName("Si el nombre está oculto no se puede buscar documentos por nombre")
    void searchByHiddenNameReturnsNothing() {
        actingAs(hiding("nombre"));
        DocumentSearchService search = new DocumentSearchService(documentRepository, context, componentPermissions);
        assertTrue(search.searchDocumentsByTenant("inf", 5).isEmpty());
    }

    // ---- Vistas de workflow que incrustan el documento ----------------------------------------------

    private WorkflowEngineService workflows() {
        return new WorkflowEngineService(jdbc, context, new ObjectMapper(), componentPermissions);
    }

    private void workflowRow() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", UUID.randomUUID());
        row.put("title", "Revisión");
        row.put("document_name", "Informe");
        row.put("document_code", "DOC-1");
        row.put("document_description", "Resumen confidencial");
        when(jdbc.queryForObject(anyString(), anyMap(), eq(Long.class))).thenReturn(1L);
        when(jdbc.queryForList(anyString(), anyMap())).thenReturn(List.of(row));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> firstOf(Map<String, Object> page) {
        return ((List<Map<String, Object>>) page.get("content")).get(0);
    }

    @Test
    @DisplayName("Lista de workflows y de tareas: el documento incrustado respeta los componentes ocultos")
    void workflowViewsHideDocumentComponents() {
        workflowRow();
        actingAs(hiding("nombre", "codigo", "descripcion"));
        Map<String, Object> flow = firstOf(workflows().list(Map.of()));
        assertNull(flow.get("document_name"));
        assertNull(flow.get("document_code"));
        assertEquals("Revisión", flow.get("title"));

        workflowRow();
        Map<String, Object> task = firstOf(workflows().tasks(Map.of()));
        assertNull(task.get("document_name"));
        assertNull(task.get("document_description"));
    }

    @Test
    @DisplayName("Workflows sin restricción (comportamiento previo) devuelven el documento completo")
    void workflowViewsUnchangedWithoutRestrictions() {
        workflowRow();
        actingAs(ComponentFormAccess.unrestricted(FORM));
        Map<String, Object> task = firstOf(workflows().tasks(Map.of()));
        assertEquals("Informe", task.get("document_name"));
        assertEquals("DOC-1", task.get("document_code"));
        assertEquals("Resumen confidencial", task.get("document_description"));
    }

    @Test
    @DisplayName("La búsqueda de tareas no filtra por el nombre de documento oculto, pero sí cuando es visible")
    void workflowSearchDoesNotInspectHiddenDocumentName() {
        workflowRow();
        actingAs(hiding("nombre"));
        workflows().tasks(Map.of("search", "informe"));
        actingAs(ComponentFormAccess.unrestricted(FORM));
        workflows().tasks(Map.of("search", "informe"));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, atLeastOnce()).queryForList(sql.capture(), anyMap());
        List<String> statements = sql.getAllValues();
        assertFalse(statements.get(0).contains("w.title,d.name"), "oculto: d.name fuera del concat de búsqueda");
        assertTrue(statements.get(1).contains("w.title,d.name"), "visible: d.name sigue en la búsqueda");
    }
}
