package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PatientQuickSummaryResponse;
import com.lta.gestdocum.backend.dto.TimelineEventResponse;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.analytics.AnalyticsDashboardResponse.AreaDistribution;
import com.lta.gestdocum.backend.model.ClinicalHistory;
import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.model.MedicalNote;
import com.lta.gestdocum.backend.model.Patient;
import com.lta.gestdocum.backend.repository.ClinicalEpisodeRepository;
import com.lta.gestdocum.backend.repository.ClinicalHistoryRepository;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository.Row;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.DocumentVersionRepository;
import com.lta.gestdocum.backend.repository.MedicalNoteRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * B2 en las vías que quedaban fuera: línea de tiempo clínica, resumen rápido del paciente (móvil),
 * búsqueda libre de documentos y usuarios, respuestas de alta y edición de usuario, analítica por área
 * y los botones «Cambiar estado» y «Subir nueva versión».
 */
@ExtendWith(MockitoExtension.class)
class HiddenComponentsRemainingPathsTest {

    @Mock private ComponentPermissionService componentPermissions;
    @Mock private AuthenticatedUserContext context;
    @Mock private ClinicalHistoryRepository historyRepository;
    @Mock private ClinicalEpisodeRepository episodeRepository;
    @Mock private MedicalNoteRepository noteRepository;
    @Mock private DocumentRepository documentRepository;
    @Mock private DocumentVersionRepository versionRepository;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID historyId = UUID.randomUUID();
    private final UUID patientId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(context.requireTenantId()).thenReturn(tenantId);
    }

    private static ComponentFormAccess hiding(String formKey, String... keys) {
        List<Row> rows = Arrays.stream(keys).map(key -> new Row(10L, key, ComponentState.HIDDEN)).toList();
        return ComponentFormAccess.resolve(ComponentFormCatalog.require(formKey), List.of(10L), rows);
    }

    private static ComponentFormAccess readOnly(String formKey, String... keys) {
        List<Row> rows = Arrays.stream(keys).map(key -> new Row(10L, key, ComponentState.VISIBLE_READONLY)).toList();
        return ComponentFormAccess.resolve(ComponentFormCatalog.require(formKey), List.of(10L), rows);
    }

    private static ComponentFormAccess open(String formKey) {
        return ComponentFormAccess.unrestricted(ComponentFormCatalog.require(formKey));
    }

    private void acting(ComponentFormAccess notes, ComponentFormAccess documents) {
        lenient().when(componentPermissions.current(ComponentFormCatalog.MEDICAL_NOTE_FORM)).thenReturn(notes);
        lenient().when(componentPermissions.current(ComponentFormCatalog.DOCUMENT_FORM)).thenReturn(documents);
    }

    private MedicalNote note() {
        MedicalNote note = MedicalNote.builder().id(UUID.randomUUID()).tenantId(tenantId).clinicalHistoryId(historyId)
                .noteType("EVOLUCION").content("Paciente con diagnóstico reservado").build();
        note.setCreatedAt(OffsetDateTime.now());
        return note;
    }

    // ---- Línea de tiempo clínica --------------------------------------------------------------------

    private List<TimelineEventResponse> timeline() {
        ClinicalHistoryService service = new ClinicalHistoryService(historyRepository, null, context, episodeRepository,
                noteRepository, documentRepository, null, null, null, null, null, null);
        ReflectionTestUtils.setField(service, "componentPermissions", componentPermissions);
        when(historyRepository.findByIdAndTenantIdAndDeletedAtIsNull(historyId, tenantId)).thenReturn(Optional.of(
                ClinicalHistory.builder().id(historyId).tenantId(tenantId).code("HC-1").build()));
        when(noteRepository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(tenantId, historyId))
                .thenReturn(List.of(note()));
        Document document = new Document(tenantId, UUID.randomUUID(), UUID.randomUUID(), "DOC-1", "Contrato secreto");
        document.setId(UUID.randomUUID());
        document.setStatus(Document.DocumentStatus.DRAFT);
        document.setCreatedAt(OffsetDateTime.now());
        when(documentRepository.findLinkedToClinicalHistory(tenantId, historyId)).thenReturn(List.of(document));
        return service.timeline(historyId);
    }

    private static TimelineEventResponse event(List<TimelineEventResponse> events, String type) {
        return events.stream().filter(e -> type.equals(e.getEventType())).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("La línea de tiempo no devuelve tipo ni contenido de nota ni código y nombre de documento ocultos")
    void timelineHidesComponents() {
        acting(hiding(ComponentFormCatalog.MEDICAL_NOTE_FORM, "tipo", "contenido"),
                hiding(ComponentFormCatalog.DOCUMENT_FORM, "codigo", "nombre"));
        List<TimelineEventResponse> events = timeline();
        assertNull(event(events, "MEDICAL_NOTE").getCode());
        assertNull(event(events, "MEDICAL_NOTE").getDescription());
        assertNull(event(events, "DOCUMENT").getCode());
        assertNull(event(events, "DOCUMENT").getDescription());
        assertEquals("HC-1", event(events, "CLINICAL_HISTORY_OPENED").getCode());
    }

    @Test
    @DisplayName("Sin componentes ocultos la línea de tiempo se mantiene igual que antes")
    void timelineUnchangedWhenVisible() {
        acting(open(ComponentFormCatalog.MEDICAL_NOTE_FORM), open(ComponentFormCatalog.DOCUMENT_FORM));
        List<TimelineEventResponse> events = timeline();
        assertEquals("EVOLUCION", event(events, "MEDICAL_NOTE").getCode());
        assertTrue(event(events, "MEDICAL_NOTE").getDescription().startsWith("Paciente"));
        assertEquals("DOC-1", event(events, "DOCUMENT").getCode());
        assertEquals("Contrato secreto", event(events, "DOCUMENT").getDescription());
    }

    // ---- Resumen rápido del paciente (app móvil) ------------------------------------------------------

    private PatientQuickSummaryResponse quickSummary() {
        PatientService patients = mock(PatientService.class);
        Patient patient = Patient.builder().id(patientId).firstName("Ana").lastName("Pérez")
                .documentType("CI").documentNumber("123").build();
        when(patients.requireByIdAndTenant(patientId, tenantId)).thenReturn(patient);
        when(historyRepository.findByTenantIdAndPatientId(tenantId, patientId)).thenReturn(Optional.of(
                ClinicalHistory.builder().id(historyId).tenantId(tenantId).code("HC-1").build()));
        when(noteRepository.findByTenantIdAndClinicalHistoryIdOrderByCreatedAtDesc(any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(note())));
        PatientQuickSummaryService service = new PatientQuickSummaryService(patients, historyRepository, noteRepository, context);
        ReflectionTestUtils.setField(service, "componentPermissions", componentPermissions);
        return service.get(patientId);
    }

    @Test
    @DisplayName("El resumen rápido del paciente no devuelve tipo ni contenido de nota ocultos")
    void quickSummaryHidesNoteComponents() {
        acting(hiding(ComponentFormCatalog.MEDICAL_NOTE_FORM, "tipo", "contenido"), open(ComponentFormCatalog.DOCUMENT_FORM));
        PatientQuickSummaryResponse.RecentNote recent = quickSummary().recentNotes().get(0);
        assertNull(recent.type());
        assertNull(recent.content());
    }

    @Test
    @DisplayName("Sin componentes ocultos el resumen rápido devuelve la nota completa")
    void quickSummaryUnchangedWhenVisible() {
        acting(open(ComponentFormCatalog.MEDICAL_NOTE_FORM), open(ComponentFormCatalog.DOCUMENT_FORM));
        PatientQuickSummaryResponse.RecentNote recent = quickSummary().recentNotes().get(0);
        assertEquals("EVOLUCION", recent.type());
        assertEquals("Paciente con diagnóstico reservado", recent.content());
    }

    // ---- Búsqueda libre por campos ocultos ------------------------------------------------------------

    @Test
    @DisplayName("La búsqueda de documentos no compara contra campos ocultos y sí contra todos sin restricción")
    void documentSearchSkipsHiddenFields() {
        assertEquals(new DocumentRepository.SearchFields(true, false, false, true, true),
                DocumentService.searchFields(hiding(ComponentFormCatalog.DOCUMENT_FORM, "codigo", "descripcion")));
        assertEquals(DocumentRepository.SearchFields.ALL,
                DocumentService.searchFields(open(ComponentFormCatalog.DOCUMENT_FORM)));
    }

    private UserFormPolicy userPolicy(ComponentFormAccess access) {
        lenient().when(componentPermissions.current(ComponentFormCatalog.USER_FORM)).thenReturn(access);
        return new UserFormPolicy(componentPermissions, null);
    }

    @Test
    @DisplayName("La búsqueda de usuarios no compara contra el correo oculto")
    void userSearchSkipsHiddenFields() {
        assertEquals(new UserRepository.SearchFields(true, false, true, true),
                userPolicy(hiding(ComponentFormCatalog.USER_FORM, "correo")).searchFields());
        assertEquals(UserRepository.SearchFields.ALL, userPolicy(open(ComponentFormCatalog.USER_FORM)).searchFields());
    }

    // ---- Respuesta de alta y edición de usuario ------------------------------------------------------

    private static UserResponse user() {
        return UserResponse.builder().id(UUID.randomUUID()).username("ana").email("ana@clinica.test")
                .firstName("Ana").lastName("Pérez").roleIds(Set.of(1L)).build();
    }

    @Test
    @DisplayName("La respuesta de alta o edición de usuario no devuelve el correo ni los grupos ocultos")
    void userResponseHidesComponents() {
        UserResponse response = userPolicy(hiding(ComponentFormCatalog.USER_FORM, "correo", "grupos")).hideComponents(user());
        assertNull(response.getEmail());
        assertNull(response.getRoleIds());
        assertEquals("Ana", response.getFirstName());
    }

    @Test
    @DisplayName("Sin componentes ocultos la respuesta de usuario queda igual")
    void userResponseUnchangedWhenVisible() {
        UserResponse response = userPolicy(open(ComponentFormCatalog.USER_FORM)).hideComponents(user());
        assertEquals("ana@clinica.test", response.getEmail());
        assertEquals(Set.of(1L), response.getRoleIds());
    }

    // ---- Analítica por área --------------------------------------------------------------------------

    private List<AreaDistribution> byArea() throws Exception {
        NamedParameterJdbcTemplate db = mock(NamedParameterJdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("area_name")).thenReturn("Legal", "Archivo");
        lenient().when(rs.getLong("doc_count")).thenReturn(3L, 2L);
        doAnswer(invocation -> {
            RowCallbackHandler handler = invocation.getArgument(2);
            String sql = invocation.getArgument(0);
            if (sql.contains("doc_count")) {
                handler.processRow(rs);
                handler.processRow(rs);
            }
            return null;
        }).when(db).query(anyString(), any(MapSqlParameterSource.class), any(RowCallbackHandler.class));
        AnalyticsService service = new AnalyticsService(db, context);
        ReflectionTestUtils.setField(service, "componentPermissions", componentPermissions);
        OffsetDateTime to = OffsetDateTime.now();
        return service.getAreaDistribution(to.minusDays(30), to);
    }

    @Test
    @DisplayName("Con el departamento oculto la analítica por área no revela nombres: agrega todo en una fila")
    void analyticsByAreaAggregatesHiddenDepartment() throws Exception {
        acting(open(ComponentFormCatalog.MEDICAL_NOTE_FORM), hiding(ComponentFormCatalog.DOCUMENT_FORM, "departamento"));
        List<AreaDistribution> areas = byArea();
        assertEquals(1, areas.size());
        assertEquals(AnalyticsService.HIDDEN_AREA, areas.get(0).area());
        assertEquals(5L, areas.get(0).documentCount());
    }

    @Test
    @DisplayName("Con el departamento visible la analítica por área conserva las áreas")
    void analyticsByAreaUnchangedWhenVisible() throws Exception {
        acting(open(ComponentFormCatalog.MEDICAL_NOTE_FORM), open(ComponentFormCatalog.DOCUMENT_FORM));
        List<AreaDistribution> areas = byArea();
        assertEquals(List.of("Legal", "Archivo"), areas.stream().map(AreaDistribution::area).toList());
    }

    // ---- Botones del documento ---------------------------------------------------------------------

    @Test
    @DisplayName("Un botón oculto o de solo lectura no se puede ejecutar; editable sí")
    void actionComponentsRequireEditable() {
        AccessDeniedException hidden = assertThrows(AccessDeniedException.class, () ->
                hiding(ComponentFormCatalog.DOCUMENT_FORM, "accion_cambiar_estado").requireEditable("accion_cambiar_estado"));
        assertTrue(hidden.getMessage().contains("Cambiar estado"));
        assertThrows(AccessDeniedException.class, () ->
                readOnly(ComponentFormCatalog.DOCUMENT_FORM, "accion_subir_version").requireEditable("accion_subir_version"));
        open(ComponentFormCatalog.DOCUMENT_FORM).requireEditable("accion_cambiar_estado");
    }

    private DocumentStorageService storage() {
        DocumentStorageService service = new DocumentStorageService(System.getProperty("java.io.tmpdir"),
                documentRepository, versionRepository, context, mock(PlanEnforcementService.class));
        service.setComponentPermissions(componentPermissions);
        UUID documentId = UUID.randomUUID();
        Document document = new Document(tenantId, UUID.randomUUID(), UUID.randomUUID(), "DOC-1", "Informe");
        document.setId(documentId);
        when(documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(any(), any())).thenReturn(Optional.of(document));
        return service;
    }

    @Test
    @DisplayName("Subir una nueva versión se rechaza si el botón no es editable para el perfil")
    void newVersionDeniedWhenActionReadOnly() {
        acting(open(ComponentFormCatalog.MEDICAL_NOTE_FORM), readOnly(ComponentFormCatalog.DOCUMENT_FORM, "accion_subir_version"));
        DocumentStorageService service = storage();
        when(versionRepository.existsByTenantIdAndDocumentId(any(), any())).thenReturn(true);
        MockMultipartFile file = new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1});
        assertThrows(AccessDeniedException.class, () -> service.upload(UUID.randomUUID(), file, "Corrección"));
    }

    @Test
    @DisplayName("La primera versión del alta no depende del botón «Subir nueva versión»")
    void firstVersionNotGatedByAction() {
        acting(open(ComponentFormCatalog.MEDICAL_NOTE_FORM), readOnly(ComponentFormCatalog.DOCUMENT_FORM, "accion_subir_version"));
        DocumentStorageService service = storage();
        when(versionRepository.existsByTenantIdAndDocumentId(any(), any())).thenReturn(false);
        MockMultipartFile empty = new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[0]);
        // Supera el control del botón y falla después en la validación del archivo vacío, no por permisos.
        RuntimeException error = assertThrows(RuntimeException.class, () -> service.upload(UUID.randomUUID(), empty, "Alta"));
        assertTrue(!(error instanceof AccessDeniedException), "no debe ser un rechazo por el botón");
    }
}
