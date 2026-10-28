package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.OcrJobResponse;
import com.lta.gestdocum.backend.dto.OcrProcessResponse;
import com.lta.gestdocum.backend.dto.OcrProcessResponse.OcrFieldDTO;
import com.lta.gestdocum.backend.dto.OcrStatsResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.OcrJob;
import com.lta.gestdocum.backend.model.OcrJob.Status;
import com.lta.gestdocum.backend.repository.OcrJobRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionOperations;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OcrJobServiceTest {

    private final UUID tenant = UUID.randomUUID();
    private final UUID user = UUID.randomUUID();
    private final Map<UUID, OcrJob> store = new LinkedHashMap<>();

    @TempDir
    Path storage;

    private OcrService ocrService;
    private OcrJobRepository repository;
    private AuthenticatedUserContext context;
    private OcrFileStore fileStore;
    private OcrJobService service;
    private Set<String> authorities = new HashSet<>();

    @BeforeEach
    void setUp() {
        ocrService = mock(OcrService.class);
        repository = mock(OcrJobRepository.class);
        context = mock(AuthenticatedUserContext.class);
        fileStore = new OcrFileStore(storage.toString());
        when(context.requireTenantId()).thenReturn(tenant);
        when(context.requireUserId()).thenReturn(user);
        when(context.hasAuthority(anyString())).thenAnswer(i -> authorities.contains(i.<String>getArgument(0)));
        when(repository.saveAndFlush(any(OcrJob.class))).thenAnswer(i -> save(i.getArgument(0)));
        when(repository.save(any(OcrJob.class))).thenAnswer(i -> save(i.getArgument(0)));
        when(repository.findByIdAndTenantId(any(), any())).thenAnswer(i -> {
            OcrJob job = store.get(i.<UUID>getArgument(0));
            return job != null && job.getTenantId().equals(i.getArgument(1)) ? Optional.of(job) : Optional.empty();
        });
        when(repository.findTop10ByTenantIdOrderByCreatedAtDesc(any())).thenAnswer(i -> recent(i.getArgument(0), null));
        when(repository.findTop10ByTenantIdAndUploadedByOrderByCreatedAtDesc(any(), any()))
                .thenAnswer(i -> recent(i.getArgument(0), i.getArgument(1)));
        when(repository.countByTenantId(any())).thenAnswer(i -> (long) store.size());
        when(repository.countByTenantIdAndStatusIn(any(), anyCollection())).thenAnswer(i ->
                store.values().stream().filter(j -> i.<Collection<Status>>getArgument(1).contains(j.getStatus())).count());
        when(repository.averageConfidence(any(), anyCollection())).thenAnswer(i -> average(i.getArgument(1),
                j -> j.getConfidenceScore() == null ? null : j.getConfidenceScore().doubleValue()));
        when(repository.averageProcessingMs(any(), anyCollection())).thenAnswer(i -> average(i.getArgument(1),
                j -> j.getProcessingMs() == null ? null : j.getProcessingMs().doubleValue()));
        service = new OcrJobService(ocrService, repository, fileStore, context, mock(DocumentService.class),
                mock(DocumentStorageService.class), mock(com.lta.gestdocum.backend.repository.DocumentRepository.class),
                TransactionOperations.withoutTransaction());
    }

    private OcrJob save(OcrJob job) {
        store.put(job.getId(), job);
        return job;
    }

    private List<OcrJob> recent(UUID tenantId, UUID owner) {
        return store.values().stream()
                .filter(j -> j.getTenantId().equals(tenantId) && (owner == null || j.getUploadedBy().equals(owner)))
                .sorted(Comparator.comparing(OcrJob::getCreatedAt).reversed())
                .limit(10).collect(Collectors.toList());
    }

    private Double average(Collection<Status> statuses, java.util.function.Function<OcrJob, Double> value) {
        return store.values().stream().filter(j -> statuses.contains(j.getStatus()))
                .map(value).filter(Objects::nonNull).mapToDouble(Double::doubleValue).average().stream().boxed().findFirst().orElse(null);
    }

    private OcrService.OcrExtraction success() {
        OcrProcessResponse data = new OcrProcessResponse("LABORATORIO", "Ana Perez", "123", null, "2026-10-01",
                "Hemograma normal", "Hemoglobina 14", 0.93,
                List.of(new OcrFieldDTO("Hemoglobina", "14", "NORMAL")), Map.of());
        return new OcrService.OcrExtraction(data, false, "gemini-x", null, 1200);
    }

    private OcrService.OcrExtraction failed(String reason) {
        OcrProcessResponse data = new OcrProcessResponse("OTRO", null, null, null, null,
                "Extracción no completada: " + reason, "Texto preliminar no disponible", 0.50,
                List.of(new OcrFieldDTO("Estado OCR", "Requiere validación manual", "ADVERTENCIA")), Map.of());
        return new OcrService.OcrExtraction(data, true, null, reason, 300);
    }

    private MockMultipartFile png() {
        return new MockMultipartFile("file", "informe.png", "image/png", "bytes".getBytes());
    }

    private OcrJob job(Status status, UUID owner, Double confidence, Integer ms) {
        OcrJob job = new OcrJob(UUID.randomUUID(), tenant, owner, "ocr/x");
        job.setStatus(status);
        if (confidence != null) job.setConfidenceScore(BigDecimal.valueOf(confidence));
        job.setProcessingMs(ms);
        store.put(job.getId(), job);
        return job;
    }

    @Test
    @DisplayName("process() persiste el job con el resultado, la confianza, el modelo y el tiempo")
    void processPersistsSuccessfulExtraction() {
        when(ocrService.extract(any(), eq("image/png"), eq("informe.png"))).thenReturn(success());

        OcrJobResponse response = service.process(png());

        OcrJob saved = store.get(response.id());
        assertEquals(Status.REQUIRES_VALIDATION, saved.getStatus());
        assertEquals(new BigDecimal("0.9300"), saved.getConfidenceScore().setScale(4));
        assertEquals("gemini-x", saved.getModelUsed());
        assertEquals(1200, saved.getProcessingMs());
        assertEquals("Hemoglobina 14", saved.getRawText());
        assertEquals("informe.png", saved.getOriginalFilename());
        assertEquals("image/png", saved.getFileType());
        assertEquals(5L, saved.getFileSizeBytes());
        assertEquals(user, saved.getUploadedBy());
        assertEquals(tenant, saved.getTenantId());
        assertEquals("REQUIRES_VALIDATION", response.status());
        assertEquals("LABORATORIO", response.documentType());
        assertEquals("Ana Perez", response.patientName());
        assertEquals(1, response.structuredFields().size());
        assertNull(response.errorMessage());
        assertTrue(Files.exists(fileStore.resolve(saved.getOriginalFilePath())), "el archivo original queda guardado");
        assertTrue(saved.getOriginalFilePath().startsWith("ocr/" + tenant + "/"));
    }

    @Test
    @DisplayName("process() registra un fallo de extraccion como FAILED y nunca como exito")
    void processRecordsFailureAsFailed() {
        when(ocrService.extract(any(), any(), any())).thenReturn(failed("Servicio de visión no configurado (falta API Key)."));

        OcrJobResponse response = service.process(png());

        OcrJob saved = store.get(response.id());
        assertEquals(Status.FAILED, saved.getStatus());
        assertEquals("FAILED", response.status());
        assertTrue(saved.getErrorMessage().contains("falta API Key"));
        assertNull(saved.getConfidenceScore(), "un fallo no aporta confianza a las metricas");
        assertNull(saved.getModelUsed());
        assertTrue(Files.exists(fileStore.resolve(saved.getOriginalFilePath())));
    }

    @Test
    @DisplayName("process() con una excepcion inesperada deja el job FAILED en vez de PROCESSING")
    void processUnexpectedExceptionMarksFailed() {
        when(ocrService.extract(any(), any(), any())).thenThrow(new IllegalStateException("boom"));

        OcrJobResponse response = service.process(png());

        assertEquals("FAILED", response.status());
        assertEquals(Status.FAILED, store.get(response.id()).getStatus());
        assertNotNull(store.get(response.id()).getErrorMessage());
    }

    @Test
    @DisplayName("process() rechaza un formato invalido sin crear job ni archivo")
    void processRejectsInvalidFileWithoutSideEffects() throws Exception {
        doThrow(new IllegalArgumentException("Formato no soportado")).when(ocrService).validateFile(any());

        assertThrows(IllegalArgumentException.class, () -> service.process(png()));

        verifyNoInteractions(repository);
        try (var files = Files.walk(storage)) {
            assertEquals(0, files.filter(Files::isRegularFile).count());
        }
    }

    @Test
    @DisplayName("process() borra el archivo si no se pudo registrar el job")
    void processCleansFileWhenInsertFails() throws Exception {
        when(repository.saveAndFlush(any(OcrJob.class))).thenThrow(new IllegalStateException("db caida"));

        assertThrows(IllegalStateException.class, () -> service.process(png()));

        try (var files = Files.walk(storage)) {
            assertEquals(0, files.filter(Files::isRegularFile).count(), "no quedan archivos huerfanos");
        }
        verify(ocrService, never()).extract(any(), any(), any());
    }

    @Test
    @DisplayName("process() sanea el nombre de archivo")
    void processSanitisesFilename() {
        when(ocrService.extract(any(), any(), any())).thenReturn(success());

        OcrJobResponse response = service.process(new MockMultipartFile("file", "../../etc/pa\\sswd.png", "image/png", "x".getBytes()));

        assertEquals("sswd.png", store.get(response.id()).getOriginalFilename());
    }

    @Test
    @DisplayName("get() solo muestra jobs propios, salvo con ocr:read; otro tenant nunca")
    void getRespectsOwnership() {
        OcrJob mine = job(Status.REQUIRES_VALIDATION, user, 0.9, 1000);
        OcrJob theirs = job(Status.REQUIRES_VALIDATION, UUID.randomUUID(), 0.9, 1000);

        assertEquals(mine.getId(), service.get(mine.getId()).id());
        assertThrows(NotFoundException.class, () -> service.get(theirs.getId()));

        authorities.add("ocr:read");
        assertEquals(theirs.getId(), service.get(theirs.getId()).id());

        OcrJob foreign = new OcrJob(UUID.randomUUID(), UUID.randomUUID(), user, "ocr/y");
        store.put(foreign.getId(), foreign);
        assertThrows(NotFoundException.class, () -> service.get(foreign.getId()));
        assertThrows(NotFoundException.class, () -> service.get(UUID.randomUUID()));
    }

    @Test
    @DisplayName("listRecent() devuelve solo los jobs propios, o todos del tenant con ocr:read")
    void listRecentRespectsOwnership() {
        job(Status.INDEXED, user, 0.9, 1000);
        job(Status.INDEXED, UUID.randomUUID(), 0.9, 1000);

        assertEquals(1, service.listRecent().size());
        authorities.add("ocr:read");
        assertEquals(2, service.listRecent().size());
    }

    @Test
    @DisplayName("stats() calcula metricas reales y excluye fallos y jobs en curso de los promedios")
    void statsAreComputedFromJobs() {
        job(Status.REQUIRES_VALIDATION, user, 0.9, 2000);
        job(Status.REQUIRES_VALIDATION, user, 0.8, 4000);
        job(Status.VALIDATED, user, 1.0, 3000);
        job(Status.INDEXED, user, 0.7, 1000);
        job(Status.REJECTED, user, 0.5, 2000);
        job(Status.FAILED, user, null, 300);
        job(Status.PROCESSING, user, null, null);

        when(ocrService.isConfigured()).thenReturn(true);
        OcrStatsResponse stats = service.stats();

        assertTrue(stats.engineConfigured());
        assertEquals(6, stats.total(), "PROCESSING aun no es una digitalizacion");
        assertEquals(5, stats.successful());
        assertEquals(1, stats.failed());
        assertEquals(1, stats.indexed());
        assertEquals(3, stats.reviewed());
        assertEquals(2, stats.accepted());
        assertEquals(1, stats.rejected());
        assertEquals(2.0 / 3.0, stats.acceptanceRate(), 1e-9);
        assertEquals((0.9 + 0.8 + 1.0 + 0.7 + 0.5) / 5, stats.averageConfidence(), 1e-9);
        assertEquals((2000 + 4000 + 3000 + 1000 + 2000) / 5.0 / 1000.0, stats.averageProcessingSeconds(), 1e-9);
    }

    @Test
    @DisplayName("stats() sin datos devuelve ceros y promedios nulos, no cifras inventadas")
    void statsWithoutDataAreNull() {
        OcrStatsResponse stats = service.stats();

        assertFalse(stats.engineConfigured(), "sin API key el motor no esta activo");
        assertEquals(0, stats.total());
        assertEquals(0, stats.successful());
        assertNull(stats.acceptanceRate());
        assertNull(stats.averageConfidence());
        assertNull(stats.averageProcessingSeconds());
    }

    @Test
    @DisplayName("S2: un PDF de varias paginas descuenta una pagina de OCR por cada pagina")
    void pdfRecordsOnePagePerPdfPage() {
        var limits = mock(PlanLimitService.class);
        service.setPlanLimitService(limits);
        when(ocrService.extract(any(), eq("application/pdf"), eq("lote.pdf"))).thenReturn(success());
        String pdf = "%PDF-1.4\n1 0 obj<</Type /Pages /Count 3>>endobj\n"
                + "2 0 obj<</Type /Page>>endobj\n3 0 obj<</Type /Page>>endobj\n4 0 obj<</Type/Page>>endobj";

        OcrJobResponse response = service.process(new MockMultipartFile("file", "lote.pdf", "application/pdf",
                pdf.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1)));

        verify(limits).validateOcrLimit(tenant, 1);
        verify(limits).validateOcrLimit(tenant, 3);
        verify(limits).recordOcrUsage(tenant, 3);
        assertEquals(3, store.get(response.id()).getPagesProcessed());
    }

    @Test
    @DisplayName("S2: una imagen sigue consumiendo una pagina")
    void imageStillRecordsOnePage() {
        var limits = mock(PlanLimitService.class);
        service.setPlanLimitService(limits);
        when(ocrService.extract(any(), eq("image/png"), eq("informe.png"))).thenReturn(success());

        service.process(png());

        verify(limits).recordOcrUsage(tenant, 1);
        verify(limits, times(1)).validateOcrLimit(any(), anyInt());
    }

    @Test
    void countPagesHandlesPdfsWithoutMarkers() {
        assertEquals(1, OcrService.countPages("%PDF-1.7 sin paginas legibles".getBytes(), "application/pdf"));
        assertEquals(1, OcrService.countPages(new byte[] {1, 2}, "image/jpeg"));
    }
}
