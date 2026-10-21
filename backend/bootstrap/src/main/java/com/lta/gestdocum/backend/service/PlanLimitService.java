package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.TenantUsageResponse;
import com.lta.gestdocum.backend.exception.PlanLimitExceededException;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.model.Tenant;
import com.lta.gestdocum.backend.model.UserStatus;
import com.lta.gestdocum.backend.repository.*;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class PlanLimitService {

    private static final Logger log = LoggerFactory.getLogger(PlanLimitService.class);

    public static final String MAX_USERS = "maxUsers";
    public static final String MAX_DOCUMENTS = "maxDocuments";
    public static final String MAX_STORAGE_MB = "maxStorageMB";
    public static final String MAX_OCR_PAGES = "maxOcrPagesPerMonth";

    private final PlanRepository planRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final PlanEnforcementService planEnforcementService;
    private final EntityManager entityManager;

    public PlanLimitService(
            PlanRepository planRepository,
            TenantRepository tenantRepository,
            UserRepository userRepository,
            DocumentRepository documentRepository,
            DocumentVersionRepository documentVersionRepository,
            PlanEnforcementService planEnforcementService,
            EntityManager entityManager) {
        this.planRepository = planRepository;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.planEnforcementService = planEnforcementService;
        this.entityManager = entityManager;
    }

    /** Valida el límite de usuarios activos según el plan contratado. */
    @Transactional(readOnly = true)
    public void validateUserLimit(UUID tenantId) {
        if (tenantId == null) return;
        planEnforcementService.validateWriteAccess(tenantId);
        UUID planId = getPlanId(tenantId);
        long maxUsers = getLimitValue(planId, MAX_USERS);
        if (maxUsers <= 0 && maxUsers != -1) return;
        if (maxUsers == -1) return;

        long currentUsers = userRepository.countByTenantIdAndStatusAndDeletedAtIsNull(tenantId, UserStatus.ACTIVE);
        if (currentUsers >= maxUsers) {
            throw new PlanLimitExceededException("Tu plan permite un máximo de " + maxUsers + " usuarios.");
        }
    }

    /** Valida el límite de documentos registrados según el plan contratado. */
    @Transactional(readOnly = true)
    public void validateDocumentLimit(UUID tenantId) {
        if (tenantId == null) return;
        planEnforcementService.validateWriteAccess(tenantId);
        UUID planId = getPlanId(tenantId);
        long maxDocs = getLimitValue(planId, MAX_DOCUMENTS);
        if (maxDocs <= 0 && maxDocs != -1) return;
        if (maxDocs == -1) return;

        long currentDocs = documentRepository.countByTenantId(tenantId);
        if (currentDocs >= maxDocs) {
            throw new PlanLimitExceededException("Tu plan permite un máximo de " + maxDocs + " documentos.");
        }
    }

    /** Valida el límite de almacenamiento disponible en MB. */
    @Transactional(readOnly = true)
    public void validateStorageLimit(UUID tenantId, long additionalBytes) {
        if (tenantId == null) return;
        planEnforcementService.validateStorageLimit(tenantId, additionalBytes);
    }

    /** Valida el límite de páginas procesadas por OCR durante el mes en curso. */
    @Transactional(readOnly = true)
    public void validateOcrLimit(UUID tenantId, int pagesToProcess) {
        if (tenantId == null) return;
        planEnforcementService.validateWriteAccess(tenantId);
        UUID planId = getPlanId(tenantId);
        long maxOcr = getLimitValue(planId, MAX_OCR_PAGES);
        if (maxOcr <= 0 && maxOcr != -1) return;
        if (maxOcr == -1) return;

        long currentMonthPages = getCurrentMonthOcrPages(tenantId);
        if ((currentMonthPages + pagesToProcess) > maxOcr) {
            throw new PlanLimitExceededException("Tu plan permite un máximo de " + maxOcr + " páginas de OCR al mes.");
        }
    }

    /** Registra la creación de un nuevo documento en el uso mensual. */
    @Transactional
    public void recordDocumentCreation(UUID tenantId) {
        recordMonthlyUsage(tenantId, 1, 0L, 0);
    }

    /** Registra bytes almacenados en el uso mensual. */
    @Transactional
    public void recordStorageUsage(UUID tenantId, long bytes) {
        recordMonthlyUsage(tenantId, 0, bytes, 0);
    }

    /** Registra páginas procesadas por OCR en el uso mensual. */
    @Transactional
    public void recordOcrUsage(UUID tenantId, int pages) {
        recordMonthlyUsage(tenantId, 0, 0L, pages);
    }

    /** Actualiza los contadores de la tabla tenant_usage_monthly mediante la función SQL segura. */
    @Transactional
    public void recordMonthlyUsage(UUID tenantId, int documents, long storageBytes, int ocrPages) {
        if (tenantId == null) return;
        try {
            entityManager.createNativeQuery(
                    "SELECT app.record_tenant_monthly_usage(?1, ?2, ?3, ?4)")
                    .setParameter(1, tenantId)
                    .setParameter(2, documents)
                    .setParameter(3, storageBytes)
                    .setParameter(4, ocrPages)
                    .getSingleResult();
        } catch (Exception exception) {
            log.warn("No se pudo registrar uso mensual en base de datos para tenant {}: {}", tenantId, exception.getMessage());
        }
    }

    /** Retorna el resumen consolidado de consumo actual vs cuotas del plan para el tenant. */
    @Transactional(readOnly = true)
    public TenantUsageResponse getUsage(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant no encontrado"));
        UUID planId = tenant.getPlanId() != null ? tenant.getPlanId() : getPlanId(tenantId);
        Plan plan = planRepository.findById(planId).orElse(null);

        long maxUsers = getLimitValue(planId, MAX_USERS);
        long maxDocs = getLimitValue(planId, MAX_DOCUMENTS);
        long maxStorageMb = getLimitValue(planId, MAX_STORAGE_MB);
        long maxStorageBytes = maxStorageMb == -1 ? -1 : maxStorageMb * 1024L * 1024L;
        long maxOcr = getLimitValue(planId, MAX_OCR_PAGES);

        long currentUsers = userRepository.countByTenantIdAndStatusAndDeletedAtIsNull(tenantId, UserStatus.ACTIVE);
        long currentDocs = documentRepository.countByTenantId(tenantId);
        long currentStorageBytes = documentVersionRepository.sumFileSizeBytesByTenantId(tenantId);
        long currentOcrPages = getCurrentMonthOcrPages(tenantId);

        long trialDays = 0;
        if (tenant.getTrialEndsAt() != null) {
            long seconds = Duration.between(Instant.now(), tenant.getTrialEndsAt()).getSeconds();
            trialDays = Math.max(0, (seconds + 86_399L) / 86_400L);
        }

        return new TenantUsageResponse(
                tenant.getId(),
                tenant.getName(),
                plan != null ? plan.getCode() : "BASIC",
                plan != null ? plan.getName() : "Plan Básico",
                tenant.getStatus() != null ? tenant.getStatus().name() : "TRIAL",
                tenant.getTrialEndsAt(),
                trialDays,
                currentUsers,
                maxUsers,
                currentDocs,
                maxDocs,
                currentStorageBytes,
                maxStorageBytes,
                currentOcrPages,
                maxOcr
        );
    }

    private UUID getPlanId(UUID tenantId) {
        return planRepository.findPlanIdByTenantIdForUpdate(tenantId)
                .orElseGet(() -> planRepository.findFirstByCodeIgnoreCaseAndActiveTrue("BASIC")
                        .map(Plan::getId)
                        .orElse(null));
    }

    private long getLimitValue(UUID planId, String resourceKey) {
        if (planId == null) return -1;
        return planRepository.findLimitValue(planId, resourceKey).orElse(-1L);
    }

    private long getCurrentMonthOcrPages(UUID tenantId) {
        try {
            LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);
            Object result = entityManager.createNativeQuery(
                    "SELECT coalesce(ocr_pages, 0) FROM tenant_usage_monthly " +
                    "WHERE tenant_id = ?1 AND year_month = ?2")
                    .setParameter(1, tenantId)
                    .setParameter(2, startOfMonth)
                    .getSingleResult();
            if (result instanceof Number num) return num.longValue();
        } catch (jakarta.persistence.NoResultException ignored) {
            return 0L;
        } catch (Exception ex) {
            log.debug("Error al consultar ocr_pages de tenant_usage_monthly: {}", ex.getMessage());
        }
        return 0L;
    }
}
