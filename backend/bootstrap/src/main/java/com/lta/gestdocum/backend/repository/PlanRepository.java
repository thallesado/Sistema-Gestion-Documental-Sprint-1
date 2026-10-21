package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.Plan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface PlanRepository extends JpaRepository<Plan, UUID> {

    List<Plan> findByActiveTrueOrderBySortOrderAsc();

    Optional<Plan> findFirstByCodeIgnoreCaseAndActiveTrue(String code);

    @Modifying
    @Query(value = "update tenants set plan_id = :planId where id = :tenantId", nativeQuery = true)
    int updateTenantPlan(@Param("tenantId") UUID tenantId, @Param("planId") UUID planId);

    @Modifying
    @Query(value = """
            update tenants set plan_id = :planId, subscription_status = cast(:status as subscription_status),
              current_period_end = :periodEnd, billing_cycle_v2 = :billingCycle,
              preferred_payment_method = :paymentMethod
            where id = :tenantId
            """, nativeQuery = true)
    int activateTenantSubscription(@Param("tenantId") UUID tenantId, @Param("planId") UUID planId,
                                   @Param("status") String status, @Param("periodEnd") java.time.Instant periodEnd,
                                   @Param("billingCycle") String billingCycle, @Param("paymentMethod") String paymentMethod);

    /**
     * Lee y bloquea la asignación del plan del tenant dentro de la transacción.
     * El bloqueo serializa comprobación y alta de recursos para el mismo tenant.
     * Es un bloqueo consultivo y no {@code FOR UPDATE}: con RLS, bloquear la fila de tenants
     * exige la política de UPDATE (configuration:update) y para cualquier otro perfil la
     * consulta no devolvía filas, lo que se traducía en un falso PLAN_LIMIT_EXCEEDED.
     */
    @Query(value = """
            with tenant_lock as (
              select pg_advisory_xact_lock(hashtextextended('plan:' || cast(:tenantId as text), 0))
            )
            select t.plan_id from tenant_lock, tenants t where t.id = :tenantId
            """, nativeQuery = true)
    Optional<UUID> findPlanIdByTenantIdForUpdate(@Param("tenantId") UUID tenantId);

    @Query(value = """
            select resource_value
            from plan_limits
            where plan_id = :planId and resource_key = :resourceKey
            """, nativeQuery = true)
    Optional<Long> findLimitValue(
            @Param("planId") UUID planId,
            @Param("resourceKey") String resourceKey);

    @Query(value = """
            select is_enabled
            from plan_features
            where plan_id = :planId and feature_key = :featureCode
            """, nativeQuery = true)
    Optional<Boolean> isFeatureEnabled(
            @Param("planId") UUID planId,
            @Param("featureCode") String featureCode);

    @Query(value = """
            select resource_key as "resourceKey", resource_value as "resourceValue", unit
            from plan_limits
            where plan_id = :planId
            order by resource_key
            """, nativeQuery = true)
    List<PlanLimitProjection> findLimitsByPlanId(@Param("planId") UUID planId);

    @Query(value = """
            select feature_key as "featureKey", is_enabled as enabled, description
            from plan_features
            where plan_id = :planId
            order by feature_key
            """, nativeQuery = true)
    List<PlanFeatureProjection> findFeaturesByPlanId(@Param("planId") UUID planId);

    @Query(value = """
            select pf.feature_key
            from tenants t
            join plan_features pf on pf.plan_id = t.plan_id
            where t.id = :tenantId and pf.is_enabled = true
            """, nativeQuery = true)
    List<String> findEnabledFeatureKeysByTenantId(@Param("tenantId") UUID tenantId);

    @Query(value = """
            select p.code
            from tenants t
            join plans p on p.id = t.plan_id
            where t.id = :tenantId
            """, nativeQuery = true)
    Optional<String> findPlanCodeByTenantId(@Param("tenantId") UUID tenantId);
}

