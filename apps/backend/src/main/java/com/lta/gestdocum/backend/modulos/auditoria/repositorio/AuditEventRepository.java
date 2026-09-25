package com.lta.gestdocum.backend.modulos.auditoria.repositorio;
import com.lta.gestdocum.backend.modulos.auditoria.modelo.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditEventRepository extends JpaRepository<AuditEvent,Long>, JpaSpecificationExecutor<AuditEvent> {
}
