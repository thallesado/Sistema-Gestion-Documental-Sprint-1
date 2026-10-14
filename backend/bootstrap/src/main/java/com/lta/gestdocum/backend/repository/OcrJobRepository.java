package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.OcrJob;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OcrJobRepository extends JpaRepository<OcrJob, UUID> {

    Optional<OcrJob> findByIdAndTenantId(UUID id, UUID tenantId);

    /** Bloquea la fila hasta el fin de la transaccion: evita validar o indexar dos veces el mismo job. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from OcrJob j where j.id = :id and j.tenantId = :tenantId")
    Optional<OcrJob> findForUpdate(@Param("id") UUID id, @Param("tenantId") UUID tenantId);

    List<OcrJob> findTop10ByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    List<OcrJob> findTop10ByTenantIdAndUploadedByOrderByCreatedAtDesc(UUID tenantId, UUID uploadedBy);

    long countByTenantId(UUID tenantId);

    long countByTenantIdAndStatusIn(UUID tenantId, Collection<OcrJob.Status> statuses);

    /** Confianza media declarada por el modelo, solo de extracciones que sí produjeron resultado. */
    @Query("select avg(j.confidenceScore) from OcrJob j where j.tenantId = :tenantId and j.status in :statuses")
    Double averageConfidence(@Param("tenantId") UUID tenantId, @Param("statuses") Collection<OcrJob.Status> statuses);

    /** Tiempo medio de procesamiento medido, solo de extracciones exitosas. */
    @Query("select avg(j.processingMs) from OcrJob j where j.tenantId = :tenantId and j.status in :statuses and j.processingMs is not null")
    Double averageProcessingMs(@Param("tenantId") UUID tenantId, @Param("statuses") Collection<OcrJob.Status> statuses);
}
