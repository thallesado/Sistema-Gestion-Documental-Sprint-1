package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.PlanFeature;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlanFeatureRepository extends JpaRepository<PlanFeature, PlanFeature.PlanFeatureId> {
    List<PlanFeature> findByPlanId(UUID planId);
    Optional<PlanFeature> findByPlanIdAndFeatureKey(UUID planId, String featureKey);
}
