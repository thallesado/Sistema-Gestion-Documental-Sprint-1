package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.PlanLimit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlanLimitRepository extends JpaRepository<PlanLimit, PlanLimit.PlanLimitId> {
    List<PlanLimit> findByPlanId(UUID planId);
    Optional<PlanLimit> findByPlanIdAndResourceKey(UUID planId, String resourceKey);
}
