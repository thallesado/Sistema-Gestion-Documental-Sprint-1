package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.SubscriptionPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SubscriptionPaymentRepository extends JpaRepository<SubscriptionPayment, UUID> {
    List<SubscriptionPayment> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
