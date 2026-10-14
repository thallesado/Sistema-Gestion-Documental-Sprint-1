package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.dto.OcrIndexRequest;
import com.lta.gestdocum.backend.dto.OcrJobResponse;
import com.lta.gestdocum.backend.dto.OcrMetadataRequest;
import com.lta.gestdocum.backend.dto.OcrRejectRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.model.OcrJob;
import com.lta.gestdocum.backend.model.OcrJob.Status;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.OcrJobRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionOperations;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OcrJobWorkflowTest {

    private final UUID tenant = UUID.randomUUID();
    private final UUID user = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();
    private final Map<UUID, OcrJob> store = new LinkedHashMap<>();
    private final Set<String> authorities = new HashSet<>();

    @TempDir
    Path storage;

    private OcrJobRepository repository;
    private AuthenticatedUserContext context;
    private DocumentService documentService;
    private DocumentStorageService documentStorage;
    private DocumentRepository documentRepository;
    private OcrJobService service;

    @BeforeEach
    void setUp() {
        repository = mock(OcrJobRepository.class);
        context = mock(AuthenticatedUserContext.class);
        documentService = mock(DocumentService.class);
        documentStorage = mock(DocumentStorageService.class);
        documentRepository = mock(DocumentRepository.class);
        when(context.requireTenantId()).thenReturn(tenant);
        when(context.requireUserId()).thenReturn(user);
        when(context.hasAuthority(anyString())).thenAnswer(i -> authorities.contains(i.<String>getArgument(0)));
        when(repository.save(any(OcrJob.class))).thenAnswer(i -> i.getArgument(0));
        org.mockito.stubbing.Answer<Optional<OcrJob>> lookup = i -> {
            OcrJob job = store.get(i.<UUID>getArgument(0));
            return job != null && job.getTenantId().equals(i.getArgument(1)) ? Optional.of(job) : Optional.empty();
        };
        when(repository.findByIdAndTenantId(any(), any())).thenAnswer(lookup);
        when(repository.findForUpdate(any(), any())).thenAnswer(lookup);
        service = new OcrJobService(mock(OcrService.class), repository, new OcrFileStore(storage.toString()), context,
                documentService, documentStorage, documentRepository, TransactionOperations.withoutTransaction());
    }

    private OcrJob job(Status status) {
        OcrJob job = new OcrJob(UUID.randomUUID(), tenant, user, "ocr/" + tenant + "/job");
        job.setStatus(status);
        job.setOriginalFilename("informe laboratorio.png");
        job.setFileType("image/png");
        job.setFileSizeBytes(5L);
        job.setConfidenceScore(new java.math.BigDecimal("0.9000"));
        job.setSuggestedMetadata(new HashMap<>(Map.of("documentType", "LABORATORIO", "patientName", "Ana Perez",
                "issueDate", "2026-10-01")));
        store.put(job.getId(), job);
        return job;
    }

    private OcrMetadataRequest corrections(String type, String patient, String doc, String doctor, String date) {
        return new OcrMetadataRequest(type, patient, doc, doctor, date);
    }

    // ---- validate ----

    @Test
    @DisplayName("validate() marca VALIDATED, registra al revisor y aplica las correcciones")
    void validateAppliesCorrections() {
        OcrJob job = job(Status.REQUIRES_VALIDATION);

        OcrJobResponse response = service.validate(job.getId(),
                corrections("receta", "Ana María Pérez", "999", null, "2026-10-02"));

        assertEquals(Status.VALIDATED, job.getStatus());
        assertEquals(user, job.getValidatedBy());
        assertNotNull(job.getValidatedAt());
        assertEquals("RECETA", job.getFinalMetadata().get("documentType"));
        assertEquals("Ana María Pérez", job.getFinalMetadata().get("patientName"));
        assertEquals("2026-10-02", response.issueDate(), "lo corregido prevalece sobre lo sugerido");
        assertEquals("RECETA", response.documentType());
        assertEquals("VALIDATED", response.status());
    }

    @Test
    @DisplayName("validate() sin correcciones confirma la extraccion tal cual")
    void validateWithoutCorrections() {
        OcrJob job = job(Status.REQUIRES_VALIDATION);

        service.validate(job.getId(), null);

        assertEquals(Status.VALIDATED, job.getStatus());
        assertTrue(job.getFinalMetadata().isEmpty());
    }

    @Test
    @DisplayName("validate() rechaza un tipo documental o una fecha invalidos sin cambiar el estado")
    void validateRejectsInvalidCorrections() {
        OcrJob job = job(Status.REQUIRES_VALIDATION);

        assertThrows(IllegalArgumentException.class,
                () -> service.validate(job.getId(), corrections("RADIOGRAFIA", null, null, null, null)));
        assertThrows(IllegalArgumentException.class,
                () -> service.validate(job.getId(), corrections(null, null, null, null, "01/10/2026")));
        assertThrows(IllegalArgumentException.class,
                () -> service.validate(job.getId(), corrections(null, null, null, null, "2026-02-31")));

        assertEquals(Status.REQUIRES_VALIDATION, job.getStatus());
        assertNull(job.getValidatedBy());
    }

    @Test
    @DisplayName("validate() solo aplica desde REQUIRES_VALIDATION")
    void validateOnlyFromRequiresValidation() {
        for (Status status : List.of(Status.FAILED, Status.REJECTED, Status.VALIDATED, Status.INDEXED, Status.PROCESSING)) {
            OcrJob job = job(status);
            assertThrows(IllegalStateException.class, () -> service.validate(job.getId(), null), status.name());
            assertEquals(status, job.getStatus());
        }
    }

    @Test
    @DisplayName("validate() sobre un job ajeno se comporta como inexistente")
    void validateForeignJobIsNotFound() {
        OcrJob job = job(Status.REQUIRES_VALIDATION);
        UUID other = UUID.randomUUID();
        when(context.requireUserId()).thenReturn(other);

        assertThrows(NotFoundException.class, () -> service.validate(job.getId(), null));
        assertEquals(Status.REQUIRES_VALIDATION, job.getStatus());
    }

    // ---- reject ----

    @Test
    @DisplayName("reject() desde REQUIRES_VALIDATION o VALIDATED registra al revisor y el motivo")
    void rejectRecordsReviewerAndReason() {
        for (Status status : List.of(Status.REQUIRES_VALIDATION, Status.VALIDATED)) {
            OcrJob job = job(status);
            OcrJobResponse response = service.reject(job.getId(), new OcrRejectRequest("Texto ilegible"));
            assertEquals(Status.REJECTED, job.getStatus());
            assertEquals(user, job.getValidatedBy());
            assertNotNull(job.getValidatedAt());
            assertEquals("Texto ilegible", job.getErrorMessage());
            assertEquals("REJECTED", response.status());
        }
    }

    @Test
    @DisplayName("reject() sin motivo usa uno por defecto y no acepta jobs fallidos ni ya indexados")
    void rejectDefaultsAndGuards() {
        OcrJob job = job(Status.REQUIRES_VALIDATION);
        service.reject(job.getId(), null);
        assertEquals("Rechazado por el revisor", job.getErrorMessage());

        for (Status status : List.of(Status.FAILED, Status.INDEXED, Status.REJECTED, Status.PROCESSING)) {
            OcrJob other = job(status);
            assertThrows(IllegalStateException.class, () -> service.reject(other.getId(), null), status.name());
            assertEquals(status, other.getStatus());
        }
    }

    // ---- index ----

    private DocumentResponse documentResponse(UUID id) {
        DocumentResponse response = mock(DocumentResponse.class);
        when(response.id()).thenReturn(id);
        return response;
    }

    @Test
    @DisplayName("index() crea el documento, adopta el archivo como version 1 y deja el job INDEXED")
    void indexCreatesDocumentAndVersion() {
        OcrJob job = job(Status.VALIDATED);
        job.setFinalMetadata(new HashMap<>(Map.of("patientName", "Ana María Pérez")));
        UUID documentId = UUID.randomUUID();
        DocumentResponse created0 = documentResponse(documentId);
        when(documentService.create(any())).thenReturn(created0);

        OcrJobResponse response = service.index(job.getId(),
                new OcrIndexRequest(typeId, null, null, null, null, null, "Resultados"));

        ArgumentCaptor<DocumentCreateRequest> created = ArgumentCaptor.forClass(DocumentCreateRequest.class);
        verify(documentService).create(created.capture());
        DocumentCreateRequest request = created.getValue();
        assertEquals(typeId, request.documentTypeId());
        assertTrue(request.code().matches("OCR-\\d{8}-[0-9A-F]{8}"), request.code());
        assertTrue(request.code().length() <= 60);
        assertEquals("informe laboratorio", request.name(), "nombre por defecto: archivo sin extension");
        assertEquals("Resultados", request.description());
        assertEquals(LocalDate.of(2026, 10, 1), request.issueDate());
        assertEquals("OCR", request.source());
        assertEquals(job.getId().toString(), request.metadata().get("ocrJobId"));
        assertEquals("Ana María Pérez", request.metadata().get("patientName"), "metadato corregido prevalece");
        assertEquals("LABORATORIO", request.metadata().get("detectedType"));

        verify(documentStorage).adoptExistingFile(eq(documentId),
                eq(storage.resolve(job.getOriginalFilePath())), eq("informe laboratorio.png"), eq("image/png"), anyString());
        assertEquals(Status.INDEXED, job.getStatus());
        assertEquals(documentId, job.getDocumentId());
        assertEquals(documentId, response.documentId());
    }

    @Test
    @DisplayName("index() respeta el codigo y el nombre indicados por el usuario")
    void indexUsesProvidedCodeAndName() {
        OcrJob job = job(Status.VALIDATED);
        DocumentResponse stub = documentResponse(UUID.randomUUID());
        when(documentService.create(any())).thenReturn(stub);

        service.index(job.getId(), new OcrIndexRequest(typeId, "LAB-2026-001", "Hemograma Ana", null, null, null, null));

        ArgumentCaptor<DocumentCreateRequest> created = ArgumentCaptor.forClass(DocumentCreateRequest.class);
        verify(documentService).create(created.capture());
        assertEquals("LAB-2026-001", created.getValue().code());
        assertEquals("Hemograma Ana", created.getValue().name());
    }

    @Test
    @DisplayName("index() solo aplica a jobs VALIDATED y no crea documentos en otro caso")
    void indexOnlyFromValidated() {
        for (Status status : List.of(Status.REQUIRES_VALIDATION, Status.INDEXED, Status.FAILED, Status.REJECTED, Status.PROCESSING)) {
            OcrJob job = job(status);
            assertThrows(IllegalStateException.class,
                    () -> service.index(job.getId(), new OcrIndexRequest(typeId, null, null, null, null, null, null)), status.name());
            assertEquals(status, job.getStatus());
        }
        verifyNoInteractions(documentService, documentStorage);
    }

    @Test
    @DisplayName("index() con codigo duplicado propaga el conflicto y deja el job VALIDATED sin tocar el archivo")
    void indexDuplicateCodeKeepsJobValidated() {
        OcrJob job = job(Status.VALIDATED);
        when(documentService.create(any())).thenThrow(new DuplicateResourceException("El código de documento ya existe"));

        assertThrows(DuplicateResourceException.class,
                () -> service.index(job.getId(), new OcrIndexRequest(typeId, "DUP", null, null, null, null, null)));

        assertEquals(Status.VALIDATED, job.getStatus());
        assertNull(job.getDocumentId());
        verifyNoInteractions(documentStorage);
    }

    @Test
    @DisplayName("index() convierte una violacion de unicidad detectada al hacer flush en conflicto 409")
    void indexDuplicateCodeDetectedOnFlush() {
        OcrJob job = job(Status.VALIDATED);
        DocumentResponse stub = documentResponse(UUID.randomUUID());
        when(documentService.create(any())).thenReturn(stub);
        doThrow(new org.springframework.dao.DataIntegrityViolationException("documents_tenant_id_code_key"))
                .when(documentRepository).flush();

        assertThrows(DuplicateResourceException.class,
                () -> service.index(job.getId(), new OcrIndexRequest(typeId, "DUP", null, null, null, null, null)));

        assertEquals(Status.VALIDATED, job.getStatus());
        verifyNoInteractions(documentStorage);
    }

    @Test
    @DisplayName("index() no marca INDEXED si falla el registro del archivo")
    void indexFileFailureLeavesJobValidated() {
        OcrJob job = job(Status.VALIDATED);
        DocumentResponse stub = documentResponse(UUID.randomUUID());
        when(documentService.create(any())).thenReturn(stub);
        doThrow(new IllegalStateException("disco lleno")).when(documentStorage)
                .adoptExistingFile(any(), any(), any(), any(), any());

        assertThrows(IllegalStateException.class,
                () -> service.index(job.getId(), new OcrIndexRequest(typeId, null, null, null, null, null, null)));

        assertEquals(Status.VALIDATED, job.getStatus());
        assertNull(job.getDocumentId());
    }

    // ---- metadata correction ----

    private Document draftDocument(UUID id) {
        Document document = new Document(tenant, typeId, user, "OCR-1", "doc");
        document.setId(id);
        document.setMetadata(new HashMap<>(Map.of("source", "OCR", "patientName", "viejo")));
        return document;
    }

    @Test
    @DisplayName("updateMetadata() en un job INDEXED actualiza tambien el documento borrador")
    void updateMetadataSyncsDocument() {
        OcrJob job = job(Status.INDEXED);
        UUID documentId = UUID.randomUUID();
        job.setDocumentId(documentId);
        Document document = draftDocument(documentId);
        when(documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenant)).thenReturn(Optional.of(document));

        OcrJobResponse response = service.updateMetadata(job.getId(),
                corrections(null, "Ana Pérez", null, "Dr. Soto", "2026-10-03"));

        assertEquals("Ana Pérez", job.getFinalMetadata().get("patientName"));
        assertEquals("Ana Pérez", document.getMetadata().get("patientName"));
        assertEquals("Dr. Soto", document.getMetadata().get("doctorName"));
        assertEquals("OCR", document.getMetadata().get("source"), "no pisa metadatos ajenos a la correccion");
        assertEquals(LocalDate.of(2026, 10, 3), document.getIssueDate());
        verify(documentRepository).save(document);
        assertEquals("Ana Pérez", response.patientName());
        assertEquals(Status.INDEXED, job.getStatus());
    }

    @Test
    @DisplayName("updateMetadata() no modifica un documento que ya no es borrador")
    void updateMetadataBlockedWhenDocumentNotDraft() {
        OcrJob job = job(Status.INDEXED);
        UUID documentId = UUID.randomUUID();
        job.setDocumentId(documentId);
        Document document = draftDocument(documentId);
        document.setStatus(Document.DocumentStatus.APPROVED);
        when(documentRepository.findByIdAndTenantIdAndDeletedAtIsNull(documentId, tenant)).thenReturn(Optional.of(document));

        assertThrows(IllegalStateException.class,
                () -> service.updateMetadata(job.getId(), corrections(null, "Otro", null, null, null)));

        assertEquals("viejo", document.getMetadata().get("patientName"));
        assertTrue(job.getFinalMetadata().isEmpty(), "nada cambia si el documento no se puede actualizar");
    }

    @Test
    @DisplayName("updateMetadata() en un job VALIDATED solo guarda los metadatos del job")
    void updateMetadataBeforeIndexing() {
        OcrJob job = job(Status.VALIDATED);

        service.updateMetadata(job.getId(), corrections(null, "Ana", null, null, null));

        assertEquals("Ana", job.getFinalMetadata().get("patientName"));
        verifyNoInteractions(documentRepository);
    }

    @Test
    @DisplayName("updateMetadata() no aplica a jobs sin validar, fallidos o rechazados")
    void updateMetadataStateGuard() {
        for (Status status : List.of(Status.REQUIRES_VALIDATION, Status.FAILED, Status.REJECTED, Status.PROCESSING)) {
            OcrJob job = job(status);
            assertThrows(IllegalStateException.class,
                    () -> service.updateMetadata(job.getId(), corrections(null, "x", null, null, null)), status.name());
        }
    }
}
