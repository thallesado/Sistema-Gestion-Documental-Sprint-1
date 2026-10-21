package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.BillingTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BillingTransactionRepository extends JpaRepository<BillingTransaction, UUID> {
    Optional<BillingTransaction> findByIdAndTenantId(UUID id, UUID tenantId);
    List<BillingTransaction> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
