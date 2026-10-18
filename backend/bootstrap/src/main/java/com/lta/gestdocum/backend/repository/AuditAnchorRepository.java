package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.AuditAnchor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuditAnchorRepository extends JpaRepository<AuditAnchor, Long> {
    List<AuditAnchor> findByTenantIdOrderByChainSeqAsc(UUID tenantId);
    List<AuditAnchor> findByTenantIdIsNullOrderByChainSeqAsc();
    Optional<AuditAnchor> findTopByTenantIdOrderByChainSeqDesc(UUID tenantId);
    Optional<AuditAnchor> findTopByTenantIdIsNullOrderByChainSeqDesc();
}
