package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuditQueryService {
    private final AuditEventRepository repository;
    private final AuthenticatedUserContext context;

    public AuditQueryService(AuditEventRepository repository, AuthenticatedUserContext context) {
        this.repository = repository;
        this.context = context;
    }

    @Transactional(readOnly = true)
    public Page<AuditEvent> list(Pageable pageable) {
        UUID tenantId = context.require().tenantId();
        if (tenantId == null) return repository.findAll(pageable);
        context.establishDatabaseContext();
        return repository.findByTenantId(tenantId, pageable);
    }
}
