package com.lta.gestdocum.backend.repository;
import com.lta.gestdocum.backend.model.AuditEvent;
import org.springframework.data.jpa.repository.*;
import java.util.*;
import org.springframework.data.domain.Page;
public interface AuditEventRepository extends JpaRepository<AuditEvent,Long> {
    Page<AuditEvent> findByTenantId(UUID tenantId, org.springframework.data.domain.Pageable pageable);
}
