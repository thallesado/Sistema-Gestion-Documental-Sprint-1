package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentCreateRequest;
import com.lta.gestdocum.backend.dto.DocumentResponse;
import com.lta.gestdocum.backend.dto.OcrIndexRequest;
import com.lta.gestdocum.backend.dto.OcrJobResponse;
import com.lta.gestdocum.backend.dto.OcrMetadataRequest;
import com.lta.gestdocum.backend.dto.OcrRejectRequest;
import com.lta.gestdocum.backend.dto.OcrProcessResponse;
import com.lta.gestdocum.backend.dto.OcrProcessResponse.OcrFieldDTO;
import com.lta.gestdocum.backend.dto.OcrStatsResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Document;
import com.lta.gestdocum.backend.model.OcrJob;
import com.lta.gestdocum.backend.model.OcrJob.Status;
import com.lta.gestdocum.backend.repository.DocumentRepository;
import com.lta.gestdocum.backend.repository.OcrJobRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Ciclo de vida persistido de una digitalización. La llamada al modelo (hasta decenas de
 * segundos) se hace fuera de cualquier transacción para no retener una conexión ni el
 * contexto de seguridad de la base de datos mientras se espera a un tercero.
 */
@Service
public class OcrJobService {

    private static final Logger log = LoggerFactory.getLogger(OcrJobService.class);

    /** Extracciones que sí produjeron resultado: base de las métricas de confianza y tiempo. */
    static final Set<Status> SUCCESSFUL = EnumSet.of(
            Status.REQUIRES_VALIDATION, Status.VALIDATED, Status.INDEXED, Status.REJECTED);
    private static final Set<Status> COUNTED = EnumSet.of(
            Status.REQUIRES_VALIDATION, Status.VALIDATED, Status.INDEXED, Status.REJECTED, Status.FAILED);
    private static final Set<Status> ACCEPTED = EnumSet.of(Status.VALIDATED, Status.INDEXED);
    private static final int MAX_FILENAME = 255;

    private final OcrService ocrService;
    private final OcrJobRepository repository;
    private final OcrFileStore fileStore;
    private final AuthenticatedUserContext context;
    private final DocumentService documentService;
    private final DocumentStorageService documentStorage;
    private final DocumentRepository documentRepository;
    private final TransactionOperations tx;
    private AuditRecorder auditRecorder;

    @Autowired(required = false)
    public void setAuditRecorder(AuditRecorder auditRecorder) {
        this.auditRecorder = auditRecorder;
    }

    @Autowired
    public OcrJobService(OcrService ocrService, OcrJobRepository repository, OcrFileStore fileStore,
                         AuthenticatedUserContext context, DocumentService documentService,
                         DocumentStorageService documentStorage, DocumentRepository documentRepository,
                         PlatformTransactionManager transactionManager) {
        this(ocrService, repository, fileStore, context, documentService, documentStorage, documentRepository,
                new TransactionTemplate(transactionManager));
    }

    OcrJobService(OcrService ocrService, OcrJobRepository repository, OcrFileStore fileStore,
                  AuthenticatedUserContext context, DocumentService documentService,
                  DocumentStorageService documentStorage, DocumentRepository documentRepository,
                  TransactionOperations tx) {
        this.ocrService = ocrService;
        this.repository = repository;
        this.fileStore = fileStore;
        this.context = context;
        this.documentService = documentService;
        this.documentStorage = documentStorage;
        this.documentRepository = documentRepository;
        this.tx = tx;
    }

    public OcrJobResponse process(MultipartFile file) {
        UUID tenantId = context.requireTenantId();
        UUID userId = context.requireUserId();
        ocrService.validateFile(file);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw new UncheckedIOException("Error al leer los bytes del archivo", exception);
        }
        String mimeType = file.getContentType().toLowerCase(Locale.ROOT);
        String filename = sanitizeFilename(file.getOriginalFilename());
        UUID jobId = UUID.randomUUID();
        String storedPath = fileStore.save(tenantId, jobId, bytes);

        try {
            tx.execute(status -> {
                context.establishDatabaseContext();
                OcrJob job = new OcrJob(jobId, tenantId, userId, storedPath);
                job.setStatus(Status.PROCESSING);
                job.setOriginalFilename(filename);
                job.setFileType(mimeType);
                job.setFileSizeBytes((long) bytes.length);
                return repository.saveAndFlush(job);
            });
        } catch (RuntimeException exception) {
            fileStore.delete(storedPath);
            throw exception;
        }

        OcrService.OcrExtraction extraction;
        try {
            extraction = ocrService.extract(bytes, mimeType, filename);
        } catch (RuntimeException exception) {
            log.error("La extracción OCR del job {} terminó con una excepción inesperada", jobId, exception);
            return markFailed(jobId, tenantId, "Error inesperado durante la extracción: " + exception.getMessage());
        }

        try {
            return tx.execute(status -> {
                context.establishDatabaseContext();
                OcrJob job = repository.findByIdAndTenantId(jobId, tenantId)
                        .orElseThrow(() -> new NotFoundException("Digitalización no encontrada"));
                applyExtraction(job, extraction, mimeType);
                return toResponse(repository.save(job));
            });
        } catch (RuntimeException exception) {
            log.error("No se pudo guardar el resultado del job {}", jobId, exception);
            markFailed(jobId, tenantId, "No se pudo guardar el resultado de la extracción");
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public OcrJobResponse get(UUID id) {
        context.establishDatabaseContext();
        return toResponse(loadVisible(id));
    }

    @Transactional(readOnly = true)
    public List<OcrJobResponse> listRecent() {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        List<OcrJob> jobs = canSeeAll()
                ? repository.findTop10ByTenantIdOrderByCreatedAtDesc(tenantId)
                : repository.findTop10ByTenantIdAndUploadedByOrderByCreatedAtDesc(tenantId, context.requireUserId());
        return jobs.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public OcrStatsResponse stats() {
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        long total = repository.countByTenantIdAndStatusIn(tenantId, COUNTED);
        long successful = repository.countByTenantIdAndStatusIn(tenantId, SUCCESSFUL);
        long failed = repository.countByTenantIdAndStatusIn(tenantId, EnumSet.of(Status.FAILED));
        long indexed = repository.countByTenantIdAndStatusIn(tenantId, EnumSet.of(Status.INDEXED));
        long accepted = repository.countByTenantIdAndStatusIn(tenantId, ACCEPTED);
        long rejected = repository.countByTenantIdAndStatusIn(tenantId, EnumSet.of(Status.REJECTED));
        long reviewed = accepted + rejected;
        Double acceptanceRate = reviewed == 0 ? null : (double) accepted / reviewed;
        Double averageConfidence = successful == 0 ? null : repository.averageConfidence(tenantId, SUCCESSFUL);
        Double averageMs = successful == 0 ? null : repository.averageProcessingMs(tenantId, SUCCESSFUL);
        return new OcrStatsResponse(ocrService.isConfigured(), total, successful, failed, indexed, reviewed, accepted, rejected,
                acceptanceRate, averageConfidence, averageMs == null ? null : averageMs / 1000.0);
    }


    /** El revisor confirma la extracción, con correcciones opcionales: REQUIRES_VALIDATION -> VALIDATED. */
    @Transactional
    public OcrJobResponse validate(UUID id, OcrMetadataRequest corrections) {
        context.establishDatabaseContext();
        OcrJob job = loadVisible(id, true);
        requireStatus(job, "validar", Status.REQUIRES_VALIDATION);
        Map<String, Object> changes = parseCorrections(corrections);
        job.getFinalMetadata().putAll(changes);
        job.setStatus(Status.VALIDATED);
        stampReview(job);
        OcrJob saved = repository.save(job);
        if (auditRecorder != null) {
            auditRecorder.record("VALIDATE", "OCR_JOBS", saved.getId(),
                    Map.of("status", "REQUIRES_VALIDATION"), Map.of("status", "VALIDATED"));
        }
        return toResponse(saved);
    }

    /** El revisor descarta la extracción. Un documento ya indexado no se puede rechazar desde aquí. */
    @Transactional
    public OcrJobResponse reject(UUID id, OcrRejectRequest request) {
        context.establishDatabaseContext();
        OcrJob job = loadVisible(id, true);
        requireStatus(job, "rechazar", Status.REQUIRES_VALIDATION, Status.VALIDATED);
        String reason = request == null || request.reason() == null || request.reason().isBlank()
                ? "Rechazado por el revisor" : request.reason().trim();
        job.setStatus(Status.REJECTED);
        job.setErrorMessage(reason);
        stampReview(job);
        OcrJob saved = repository.save(job);
        if (auditRecorder != null) {
            auditRecorder.record("REJECT", "OCR_JOBS", saved.getId(),
                    Map.of("status", "REQUIRES_VALIDATION"), Map.of("status", "REJECTED", "reason", reason));
        }
        return toResponse(saved);
    }

    /**
     * Convierte una digitalización validada en un documento del repositorio, con el archivo
     * original como versión 1. Todo ocurre en una transacción: si algo falla no queda un
     * documento a medias y el job sigue VALIDATED.
     */
    @Transactional
    public OcrJobResponse index(UUID id, OcrIndexRequest request) {
        context.establishDatabaseContext();
        OcrJob job = loadVisible(id, true);
        requireStatus(job, "indexar", Status.VALIDATED);
        Map<String, Object> effective = effectiveMetadata(job);

        DocumentResponse created = documentService.create(new DocumentCreateRequest(
                request.documentTypeId(), request.expedientId(), null, request.departmentId(), request.patientId(),
                null, null, documentMetadata(job, effective),
                blankToDefault(request.code(), defaultCode(job)),
                blankToDefault(request.name(), defaultName(job)),
                request.description(), lenientDate(effective.get("issueDate")), null, false, "OCR"));
        try {
            // El INSERT del documento se difiere hasta el flush; sin esto un codigo repetido
            // explotaria al confirmar la transaccion (500) en lugar de ser un conflicto (409).
            documentRepository.flush();
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            throw new com.lta.gestdocum.backend.exception.DuplicateResourceException(
                    "El código de documento ya existe o referencia datos inválidos");
        }
        documentStorage.adoptExistingFile(created.id(), fileStore.resolve(job.getOriginalFilePath()),
                job.getOriginalFilename(), job.getFileType(), "Digitalización OCR");

        job.setDocumentId(created.id());
        job.setStatus(Status.INDEXED);
        job.setUpdatedAt(OffsetDateTime.now());
        OcrJob saved = repository.save(job);
        if (auditRecorder != null) {
            auditRecorder.record("INDEX", "OCR_JOBS", saved.getId(),
                    Map.of("status", "VALIDATED"), Map.of("status", "INDEXED", "documentId", String.valueOf(created.id())));
        }
        return toResponse(saved);
    }

    /** Corrección final de metadatos; si el documento ya existe y sigue en borrador, se actualiza también. */
    @Transactional
    public OcrJobResponse updateMetadata(UUID id, OcrMetadataRequest corrections) {
        context.establishDatabaseContext();
        OcrJob job = loadVisible(id, true);
        requireStatus(job, "corregir metadatos de", Status.VALIDATED, Status.INDEXED);
        Map<String, Object> changes = parseCorrections(corrections);

        if (job.getStatus() == Status.INDEXED) {
            Document document = documentRepository
                    .findByIdAndTenantIdAndDeletedAtIsNull(job.getDocumentId(), job.getTenantId())
                    .orElseThrow(() -> new NotFoundException("Documento no encontrado"));
            if (document.getStatus() != Document.DocumentStatus.DRAFT) {
                throw new IllegalStateException("El documento ya no es un borrador y no se puede modificar desde la digitalización");
            }
            Map<String, Object> merged = new LinkedHashMap<>(document.getMetadata());
            changes.forEach((key, value) -> merged.put("documentType".equals(key) ? "detectedType" : key, value));
            document.setMetadata(merged);
            if (changes.containsKey("issueDate")) {
                document.setIssueDate(LocalDate.parse((String) changes.get("issueDate")));
            }
            document.setUpdatedAt(OffsetDateTime.now());
            documentRepository.save(document);
        }
        job.getFinalMetadata().putAll(changes);
        job.setUpdatedAt(OffsetDateTime.now());
        return toResponse(repository.save(job));
    }

    private static void requireStatus(OcrJob job, String action, Status... allowed) {
        if (!Arrays.asList(allowed).contains(job.getStatus())) {
            throw new IllegalStateException("No se puede " + action + " una digitalización en estado " + job.getStatus());
        }
    }

    private void stampReview(OcrJob job) {
        job.setValidatedBy(context.requireUserId());
        job.setValidatedAt(OffsetDateTime.now());
        job.setUpdatedAt(job.getValidatedAt());
    }

    /** Solo los campos informados; el tipo documental y la fecha se validan antes de aceptarlos. */
    private Map<String, Object> parseCorrections(OcrMetadataRequest corrections) {
        Map<String, Object> changes = new LinkedHashMap<>();
        if (corrections == null) {
            return changes;
        }
        putIfPresent(changes, "patientName", corrections.patientName());
        putIfPresent(changes, "patientDocumentNumber", corrections.patientDocumentNumber());
        putIfPresent(changes, "doctorName", corrections.doctorName());
        String type = corrections.documentType() == null ? "" : corrections.documentType().trim().toUpperCase(Locale.ROOT);
        if (!type.isEmpty()) {
            if (!OcrService.DOCUMENT_TYPES.contains(type)) {
                throw new IllegalArgumentException("Tipo documental no válido: " + corrections.documentType());
            }
            changes.put("documentType", type);
        }
        String date = corrections.issueDate() == null ? "" : corrections.issueDate().trim();
        if (!date.isEmpty()) {
            try {
                LocalDate.parse(date, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (DateTimeParseException exception) {
                throw new IllegalArgumentException("La fecha debe tener el formato AAAA-MM-DD");
            }
            changes.put("issueDate", date);
        }
        return changes;
    }

    private static void putIfPresent(Map<String, Object> target, String key, String value) {
        if (value != null && !value.isBlank()) {
            target.put(key, value.trim());
        }
    }

    private static Map<String, Object> effectiveMetadata(OcrJob job) {
        Map<String, Object> effective = new LinkedHashMap<>(job.getSuggestedMetadata());
        effective.putAll(job.getFinalMetadata());
        return effective;
    }

    private static Map<String, Object> documentMetadata(OcrJob job, Map<String, Object> effective) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("source", "OCR");
        metadata.put("ocrJobId", job.getId().toString());
        putIfPresent(metadata, "detectedType", text(effective.get("documentType")));
        putIfPresent(metadata, "patientName", text(effective.get("patientName")));
        putIfPresent(metadata, "patientDocumentNumber", text(effective.get("patientDocumentNumber")));
        putIfPresent(metadata, "doctorName", text(effective.get("doctorName")));
        putIfPresent(metadata, "issueDate", text(effective.get("issueDate")));
        return metadata;
    }

    private static String defaultCode(OcrJob job) {
        String stamp = DateTimeFormatter.BASIC_ISO_DATE.format(job.getCreatedAt().toLocalDate());
        return "OCR-" + stamp + "-" + job.getId().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private static String defaultName(OcrJob job) {
        String name = job.getOriginalFilename() == null ? "" : job.getOriginalFilename();
        int dot = name.lastIndexOf('.');
        String base = (dot > 0 ? name.substring(0, dot) : name).trim();
        return base.isEmpty() ? "Documento digitalizado" : base;
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static LocalDate lenientDate(Object value) {
        try {
            return value == null ? null : LocalDate.parse(String.valueOf(value));
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    /** Un job ajeno se trata como inexistente para no revelar datos de pacientes de otros usuarios. */
    OcrJob loadVisible(UUID id) {
        return loadVisible(id, false);
    }

    private OcrJob loadVisible(UUID id, boolean forUpdate) {
        UUID tenantId = context.requireTenantId();
        OcrJob job = (forUpdate ? repository.findForUpdate(id, tenantId) : repository.findByIdAndTenantId(id, tenantId))
                .orElseThrow(() -> new NotFoundException("Digitalización no encontrada"));
        if (!canSeeAll() && !job.getUploadedBy().equals(context.requireUserId())) {
            throw new NotFoundException("Digitalización no encontrada");
        }
        return job;
    }

    boolean canSeeAll() {
        return context.hasAuthority("ocr:read");
    }

    private OcrJobResponse markFailed(UUID jobId, UUID tenantId, String reason) {
        return tx.execute(status -> {
            context.establishDatabaseContext();
            OcrJob job = repository.findByIdAndTenantId(jobId, tenantId)
                    .orElseThrow(() -> new NotFoundException("Digitalización no encontrada"));
            job.setStatus(Status.FAILED);
            job.setErrorMessage(reason);
            job.setUpdatedAt(OffsetDateTime.now());
            return toResponse(repository.save(job));
        });
    }

    private void applyExtraction(OcrJob job, OcrService.OcrExtraction extraction, String mimeType) {
        OcrProcessResponse data = extraction.data();
        job.setProcessingMs((int) Math.min(extraction.elapsedMs(), Integer.MAX_VALUE));
        job.setPagesTotal(mimeType.startsWith("image/") ? 1 : null);
        job.setUpdatedAt(OffsetDateTime.now());
        if (extraction.fallback()) {
            job.setStatus(Status.FAILED);
            job.setErrorMessage(extraction.failureReason());
            job.setPagesProcessed(0);
            return;
        }
        job.setStatus(Status.REQUIRES_VALIDATION);
        job.setPagesProcessed(1);
        job.setModelUsed(extraction.model());
        job.setRawText(data.fullText());
        job.setConfidenceScore(BigDecimal.valueOf(data.confidence() == null ? 0.0 : data.confidence())
                .setScale(4, RoundingMode.HALF_UP));
        Map<String, Object> extracted = new LinkedHashMap<>();
        extracted.put("extractedSummary", data.extractedSummary());
        List<Map<String, String>> fields = new ArrayList<>();
        for (OcrFieldDTO field : data.structuredFields()) {
            fields.add(Map.of("key", String.valueOf(field.key()), "value", String.valueOf(field.value()),
                    "status", String.valueOf(field.status())));
        }
        extracted.put("structuredFields", fields);
        job.setExtractedData(extracted);
        Map<String, Object> suggested = new LinkedHashMap<>();
        suggested.put("documentType", data.documentType());
        suggested.put("patientName", data.patientName());
        suggested.put("patientDocumentNumber", data.patientDocumentNumber());
        suggested.put("doctorName", data.doctorName());
        suggested.put("issueDate", data.issueDate());
        job.setSuggestedMetadata(suggested);
    }

    OcrJobResponse toResponse(OcrJob job) {
        Map<String, Object> effective = new LinkedHashMap<>(job.getSuggestedMetadata());
        effective.putAll(job.getFinalMetadata());
        List<OcrFieldDTO> fields = new ArrayList<>();
        Object stored = job.getExtractedData().get("structuredFields");
        if (stored instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    fields.add(new OcrFieldDTO(text(map.get("key")), text(map.get("value")), text(map.get("status"))));
                }
            }
        }
        return new OcrJobResponse(
                job.getId(), job.getStatus().name(), job.getOriginalFilename(), job.getFileType(),
                job.getFileSizeBytes(), text(effective.get("documentType")), text(effective.get("patientName")),
                text(effective.get("patientDocumentNumber")), text(effective.get("doctorName")),
                text(effective.get("issueDate")), text(job.getExtractedData().get("extractedSummary")),
                job.getRawText(), job.getConfidenceScore() == null ? null : job.getConfidenceScore().doubleValue(),
                fields, job.getFinalMetadata(), job.getModelUsed(), job.getProcessingMs(), job.getErrorMessage(),
                job.getDocumentId(), job.getCreatedAt(), job.getValidatedAt());
    }

    static String sanitizeFilename(String original) {
        if (original == null) {
            return "documento";
        }
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "").trim();
        if (name.isEmpty()) {
            return "documento";
        }
        return name.length() > MAX_FILENAME ? name.substring(0, MAX_FILENAME) : name;
    }

    private static String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
