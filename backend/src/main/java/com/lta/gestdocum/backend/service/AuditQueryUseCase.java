package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditEventFilter;
import com.lta.gestdocum.backend.dto.AuditEventResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditQueryUseCase {
    Page<AuditEventResponse> list(AuditEventFilter filters, Pageable pageable);
}
