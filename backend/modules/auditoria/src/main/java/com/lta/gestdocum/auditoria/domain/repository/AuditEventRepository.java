package com.lta.gestdocum.auditoria.domain.repository;
import com.lta.gestdocum.auditoria.domain.model.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditEventRepository extends JpaRepository<AuditEvent,Long>, JpaSpecificationExecutor<AuditEvent> {
}
