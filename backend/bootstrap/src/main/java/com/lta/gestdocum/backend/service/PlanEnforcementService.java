package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.exception.PlanLimitExceededException;
import com.lta.gestdocum.backend.exception.TenantMismatchException;
import com.lta.gestdocum.backend.dto.MySubscriptionResponse;
import com.lta.gestdocum.backend.dto.PlanCatalogResponse;
import com.lta.gestdocum.backend.dto.PlanFeatureResponse;
import com.lta.gestdocum.backend.dto.PlanLimitResponse;
import com.lta.gestdocum.backend.dto.PlanChangeRequest;
import com.lta.gestdocum.backend.dto.EnterpriseInquiryRequest;
import com.lta.gestdocum.backend.dto.EnterpriseInquiryResponse;
import com.lta.gestdocum.backend.model.EnterpriseInquiry;
import com.lta.gestdocum.backend.model.Plan;
import com.lta.gestdocum.backend.repository.DocumentVersionRepository;
import com.lta.gestdocum.backend.repository.EnterpriseInquiryRepository;
import com.lta.gestdocum.backend.repository.PlanRepository;
import com.lta.gestdocum.backend.repository.TenantRepository;
import com.lta.gestdocum.backend.repository.UserRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.UUID;
import java.util.List;
import java.time.Instant;
import java.time.Duration;

/**
 * Punto central de control de la suscripción del tenant autenticado.
 * Los límites con valor {@code -1} representan capacidad ilimitada.
 */
@Service
public class PlanEnforcementService {

    private static final String MAX_USERS = "maxUsers";
    private static final String MAX_STORAGE_MB = "maxStorageMB";
    private static final long BYTES_PER_MB = 1024L * 1024L;

    private final PlanRepository planRepository;
    private final UserRepository userRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final TenantRepository tenantRepository;
    private final EnterpriseInquiryRepository enterpriseInquiryRepository;
    private final AuthenticatedUserContext authenticatedUserContext;
    private final MessageSource messageSource;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.lta.gestdocum.backend.repository.RoleRepository roleRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.lta.gestdocum.backend.repository.PermissionRepository permissionRepository;

    public PlanEnforcementService(PlanRepository planRepository,
                                  UserRepository userRepository,
                                  DocumentVersionRepository documentVersionRepository,
                                  TenantRepository tenantRepository,
                                  EnterpriseInquiryRepository enterpriseInquiryRepository,
                                  AuthenticatedUserContext authenticatedUserContext,
                                  MessageSource messageSource) {
        this.planRepository = planRepository;
        this.userRepository = userRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.tenantRepository = tenantRepository;
        this.enterpriseInquiryRepository = enterpriseInquiryRepository;
        this.authenticatedUserContext = authenticatedUserContext;
        this.messageSource = messageSource;
    }

    /** Verifica que el alta de un usuario activo no sobrepase el límite del plan. */
    @Transactional
    public void validateUserLimit(UUID tenantId) {
        validateWriteAccess(tenantId);
        UUID planId = requireCurrentTenantPlan(tenantId);
        long maxUsers = requiredLimit(planId, MAX_USERS);
        if (maxUsers == -1) {
            return;
        }

        long activeUsers = userRepository.countByTenantIdAndStatusAndDeletedAtIsNull(
                tenantId, com.lta.gestdocum.backend.model.UserStatus.ACTIVE);
        if (activeUsers >= maxUsers) {
            throw new PlanLimitExceededException(message("plan.limit.users", maxUsers));
        }
    }

    /**
     * Verifica la cuota antes de agregar una nueva versión de documento. Solo se
     * suman versiones pertenecientes al tenant solicitado.
     */
    @Transactional
    public void validateStorageLimit(UUID tenantId, long additionalBytes) {
        if (additionalBytes < 0) {
            throw new IllegalArgumentException(message("plan.limit.request"));
        }

        validateWriteAccess(tenantId);
        UUID planId = requireCurrentTenantPlan(tenantId);
        long maxStorageMb = requiredLimit(planId, MAX_STORAGE_MB);
        if (maxStorageMb == -1) {
            return;
        }

        try {
            long maxStorageBytes = Math.multiplyExact(maxStorageMb, BYTES_PER_MB);
            long usedBytes = documentVersionRepository.sumFileSizeBytesByTenantId(tenantId);
            long projectedBytes = Math.addExact(usedBytes, additionalBytes);
            if (projectedBytes > maxStorageBytes) {
                throw new PlanLimitExceededException(message("plan.limit.storage", maxStorageMb));
            }
        } catch (ArithmeticException exception) {
            throw new PlanLimitExceededException(message("plan.limit.request"));
        }
    }

    /** Devuelve si una funcionalidad está habilitada para el plan del tenant actual. */
    @Transactional
    public boolean hasFeature(UUID tenantId, String featureCode) {
        if (featureCode == null || featureCode.isBlank()) {
            throw new IllegalArgumentException("El código de funcionalidad es obligatorio");
        }
        UUID planId = requireCurrentTenantPlan(tenantId);
        return planRepository.isFeatureEnabled(planId, featureCode.trim()).orElse(false);
    }

    /** Devuelve el catálogo público para usuarios autenticados, ordenado para la UI. */
    @Transactional(readOnly = true)
    public List<PlanCatalogResponse> listAvailablePlans() {
        return planRepository.findByActiveTrueOrderBySortOrderAsc().stream()
                .map(this::toPlanResponse)
                .toList();
    }

    /** Resume la suscripción y el consumo aislado del tenant autenticado. */
    @Transactional
    public MySubscriptionResponse getCurrentSubscription() {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        UUID planId = requireCurrentTenantPlan(tenantId);
        var tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new PlanLimitExceededException(message("plan.subscription.missing")));
        Plan plan = planRepository.findById(planId)
                .orElseThrow(() -> new PlanLimitExceededException(message("plan.subscription.unavailable")));
        long maxUsers = requiredLimit(planId, MAX_USERS);
        long maxStorageMb = requiredLimit(planId, MAX_STORAGE_MB);
        long maxStorageBytes = maxStorageMb == -1 ? -1 : toBytes(maxStorageMb);
        List<String> enabledFeatures = planRepository.findFeaturesByPlanId(planId).stream()
                .filter(feature -> feature.getEnabled())
                .map(feature -> feature.getFeatureKey())
                .toList();

        return new MySubscriptionResponse(
                toPlanResponse(plan),
                userRepository.countByTenantIdAndStatusAndDeletedAtIsNull(
                        tenantId, com.lta.gestdocum.backend.model.UserStatus.ACTIVE),
                maxUsers,
                documentVersionRepository.sumFileSizeBytesByTenantId(tenantId),
                maxStorageBytes,
                enabledFeatures,
                tenant.getStatus().name(),
                tenant.getTrialEndsAt(),
                trialDaysRemaining(tenant.getTrialEndsAt()),
                tenant.getBillingCycle(),
                tenant.getPreferredPaymentMethod());
    }

    /** Changes a tenant only to a self-service plan after checking current usage. */
    @Transactional
    public MySubscriptionResponse changeCurrentPlan(PlanChangeRequest request) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        requireCurrentTenantPlan(tenantId); // establishes tenant context and serializes plan changes
        // Cambiar de plan sin cobro solo vale durante la prueba; una suscripción pagada cambia de plan
        // desde Facturación > Gestionar suscripción (pago inmediato o cambio al próximo período).
        var tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalStateException(message("plan.subscription.missing")));
        if (tenant.getStatus() != com.lta.gestdocum.backend.model.Tenant.Status.TRIAL) {
            throw new IllegalStateException("El plan de una suscripción pagada se cambia desde Facturación > Gestionar suscripción");
        }
        String code = normalizeSelfServicePlan(request.planCode());
        Plan target = planRepository.findFirstByCodeIgnoreCaseAndActiveTrue(code)
                .orElseThrow(() -> new IllegalArgumentException(message("plan.change.unavailable")));
        assertCurrentUsageFits(tenantId, target.getId());
        if (planRepository.updateTenantPlan(tenantId, target.getId()) != 1) {
            throw new IllegalStateException(message("plan.subscription.missing"));
        }
        grantNewPlanPermissionsToAdminRole(tenantId, target.getId());
        return getCurrentSubscription();
    }

    /** Concede al grupo administrador los permisos que habilita el plan; llamar con el contexto RLS establecido. */
    public void grantNewPlanPermissionsToAdminRole(UUID tenantId, UUID planId) {
        if (roleRepository == null || permissionRepository == null) return;
        try {
            com.lta.gestdocum.backend.model.Role adminRole = roleRepository.findByTenantIdAndNameIgnoreCase(tenantId, "Administrador de tenant")
                    .orElse(null);
            if (adminRole == null) return;
            java.util.List<String> enabledFeatures = planRepository.findFeaturesByPlanId(planId).stream()
                    .filter(f -> Boolean.TRUE.equals(f.getEnabled()))
                    .map(com.lta.gestdocum.backend.repository.PlanFeatureProjection::getFeatureKey)
                    .toList();
            java.util.Set<String> featureSet = new java.util.HashSet<>(enabledFeatures);
            java.util.Set<Long> existingPermissionIds = roleRepository.findPermissionIds(tenantId, adminRole.getId());
            permissionRepository.findByIsActiveTrueOrderByModuleAscActionAsc().stream()
                    .filter(perm -> PlanFeatureMatrix.isPermissionAllowed(perm.getModule(), perm.getCode(), featureSet))
                    .filter(perm -> !existingPermissionIds.contains(perm.getId()))
                    .forEach(perm -> roleRepository.grantPermission(tenantId, adminRole.getId(), perm.getId()));
        } catch (Exception ignored) {
        }
    }


    /** Persists an Enterprise commercial lead for the authenticated organization. */
    @Transactional
    public EnterpriseInquiryResponse submitEnterpriseInquiry(EnterpriseInquiryRequest request) {
        UUID tenantId = authenticatedUserContext.requireTenantId();
        authenticatedUserContext.establishDatabaseContext();
        var tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalStateException(message("plan.subscription.missing")));
        var user = authenticatedUserContext.require();
        EnterpriseInquiry inquiry = enterpriseInquiryRepository.save(new EnterpriseInquiry(
                tenantId, user.userId(), tenant.getName(), request.contactName().trim(), request.email().trim(),
                blankToNull(request.phone()), request.estimatedUsers(), request.dicom(), request.bulkOcr(),
                request.interoperability(), blankToNull(request.message())));
        return new EnterpriseInquiryResponse(inquiry.getId(), true, message("plan.enterprise.accepted"));
    }

    private UUID requireCurrentTenantPlan(UUID tenantId) {
        UUID currentTenantId = authenticatedUserContext.requireTenantId();
        if (!currentTenantId.equals(tenantId)) {
            throw new TenantMismatchException();
        }
        authenticatedUserContext.establishDatabaseContext();
        return planRepository.findPlanIdByTenantIdForUpdate(tenantId)
                .orElseThrow(() -> new PlanLimitExceededException(message("plan.subscription.missing")));
    }

    /** Blocks critical mutations once the exactly twelve-day trial has expired. */
    @Transactional
    public void validateWriteAccess(UUID tenantId) {
        UUID currentTenantId = authenticatedUserContext.requireTenantId();
        if (!currentTenantId.equals(tenantId)) throw new TenantMismatchException();
        authenticatedUserContext.establishDatabaseContext();
        var tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new PlanLimitExceededException(message("plan.subscription.missing")));
        if (tenant.getStatus() == com.lta.gestdocum.backend.model.Tenant.Status.TRIAL
                && tenant.getTrialEndsAt() != null && Instant.now().isAfter(tenant.getTrialEndsAt())) {
            throw new PlanLimitExceededException(message("plan.trial.expired"));
        }
        if (tenant.getStatus() == com.lta.gestdocum.backend.model.Tenant.Status.EXPIRED
                || tenant.getStatus() == com.lta.gestdocum.backend.model.Tenant.Status.PAST_DUE) {
            throw new PlanLimitExceededException(message("plan.subscription.payment_required"));
        }
    }

    private long trialDaysRemaining(Instant trialEndsAt) {
        if (trialEndsAt == null) return 0;
        long seconds = Duration.between(Instant.now(), trialEndsAt).getSeconds();
        return Math.max(0, (seconds + 86_399L) / 86_400L);
    }

    private long requiredLimit(UUID planId, String resourceKey) {
        return planRepository.findLimitValue(planId, resourceKey)
                .orElseThrow(() -> new PlanLimitExceededException(message("plan.limit.missing", resourceKey)));
    }

    /** Rechaza un plan cuyos límites no admiten el uso actual; llamar con el contexto RLS establecido. */
    public void assertCurrentUsageFits(UUID tenantId, UUID planId) {
        long maxUsers = requiredLimit(planId, MAX_USERS);
        long activeUsers = userRepository.countByTenantIdAndStatusAndDeletedAtIsNull(
                tenantId, com.lta.gestdocum.backend.model.UserStatus.ACTIVE);
        if (maxUsers != -1 && activeUsers > maxUsers) {
            throw new PlanLimitExceededException(message("plan.change.users", maxUsers));
        }
        long maxStorageMb = requiredLimit(planId, MAX_STORAGE_MB);
        long usedBytes = documentVersionRepository.sumFileSizeBytesByTenantId(tenantId);
        if (maxStorageMb != -1 && usedBytes > toBytes(maxStorageMb)) {
            throw new PlanLimitExceededException(message("plan.change.storage", maxStorageMb));
        }
    }

    private String normalizeSelfServicePlan(String rawCode) {
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase(java.util.Locale.ROOT);
        if ("BASICO".equals(code) || "BÁSICO".equals(code)) code = "BASIC";
        if (!"BASIC".equals(code) && !"PRO".equals(code)) {
            throw new IllegalArgumentException(message("plan.change.self_service_only"));
        }
        return code;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private PlanCatalogResponse toPlanResponse(Plan plan) {
        List<PlanLimitResponse> limits = planRepository.findLimitsByPlanId(plan.getId()).stream()
                .map(limit -> new PlanLimitResponse(
                        limit.getResourceKey(), limit.getResourceValue(), limit.getUnit()))
                .toList();
        List<PlanFeatureResponse> features = planRepository.findFeaturesByPlanId(plan.getId()).stream()
                .map(feature -> new PlanFeatureResponse(
                        feature.getFeatureKey(), feature.getEnabled(), feature.getDescription()))
                .toList();
        return new PlanCatalogResponse(
                plan.getId(), plan.getCode(), plan.getName(), plan.getDescription(),
                plan.getPriceMonthly(), plan.getPriceYearly(), limits, features);
    }

    private long toBytes(long megabytes) {
        try {
            return Math.multiplyExact(megabytes, BYTES_PER_MB);
        } catch (ArithmeticException exception) {
            throw new PlanLimitExceededException(message("plan.limit.invalid_storage"));
        }
    }

    private String message(String code, Object... arguments) {
        return messageSource.getMessage(code, arguments, LocaleContextHolder.getLocale());
    }
}
