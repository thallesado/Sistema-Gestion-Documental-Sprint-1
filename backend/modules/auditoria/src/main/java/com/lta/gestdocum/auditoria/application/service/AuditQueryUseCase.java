package com.lta.gestdocum.auditoria.application.service;

import com.lta.gestdocum.auditoria.application.dto.AuditEventFilter;
import com.lta.gestdocum.auditoria.application.dto.AuditEventResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditQueryUseCase {
    Page<AuditEventResponse> list(AuditEventFilter filters, Pageable pageable);
}
