package com.lta.gestdocum.backend.repository;

import com.lta.gestdocum.backend.model.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long>, JpaSpecificationExecutor<AuditEvent> {
    List<AuditEvent> findByTenantIdOrderByChainSeqAsc(UUID tenantId);
    List<AuditEvent> findByTenantIdIsNullOrderByChainSeqAsc();
    Optional<AuditEvent> findTopByTenantIdOrderByChainSeqDesc(UUID tenantId);
    Optional<AuditEvent> findTopByTenantIdIsNullOrderByChainSeqDesc();
}
