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
import java.time.OffsetDateTime;
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
    private final TransactionOperations tx;

    @Autowired
    public OcrJobService(OcrService ocrService, OcrJobRepository repository, OcrFileStore fileStore,
                         AuthenticatedUserContext context, PlatformTransactionManager transactionManager) {
        this(ocrService, repository, fileStore, context, new TransactionTemplate(transactionManager));
    }

    OcrJobService(OcrService ocrService, OcrJobRepository repository, OcrFileStore fileStore,
                  AuthenticatedUserContext context, TransactionOperations tx) {
        this.ocrService = ocrService;
        this.repository = repository;
        this.fileStore = fileStore;
        this.context = context;
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
        return new OcrStatsResponse(total, successful, failed, indexed, reviewed, accepted, rejected,
                acceptanceRate, averageConfidence, averageMs == null ? null : averageMs / 1000.0);
    }

    /** Un job ajeno se trata como inexistente para no revelar datos de pacientes de otros usuarios. */
    OcrJob loadVisible(UUID id) {
        UUID tenantId = context.requireTenantId();
        OcrJob job = repository.findByIdAndTenantId(id, tenantId)
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
