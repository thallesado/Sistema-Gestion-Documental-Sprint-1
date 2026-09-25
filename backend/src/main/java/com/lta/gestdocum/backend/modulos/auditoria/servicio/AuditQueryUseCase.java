package com.lta.gestdocum.backend.modulos.auditoria.servicio;

import com.lta.gestdocum.backend.modulos.auditoria.dto.AuditEventFilter;
import com.lta.gestdocum.backend.modulos.auditoria.dto.AuditEventResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditQueryUseCase {
    Page<AuditEventResponse> list(AuditEventFilter filters, Pageable pageable);
}
