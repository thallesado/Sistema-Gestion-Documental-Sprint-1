package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ExpedientResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.Expedient;
import com.lta.gestdocum.backend.repository.ExpedientRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ExpedientService {

    private final ExpedientRepository repository;
    private final AuthenticatedUserContext userContext;

    public ExpedientService(ExpedientRepository repository, AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<ExpedientResponse> find(String filter, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return repository.findByTenant(tenantId, CrudTextSupport.likePattern(filter), pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ExpedientResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        UUID tenantId = userContext.requireTenantId();
        Expedient expedient = repository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new NotFoundException("Expediente no encontrado"));
        return toResponse(expedient);
    }

    private ExpedientResponse toResponse(Expedient expedient) {
        return new ExpedientResponse(
                expedient.getId(),
                expedient.getExpedientTypeId(),
                expedient.getResponsibleId(),
                expedient.getDepartmentId(),
                expedient.getCode(),
                expedient.getName(),
                expedient.getDescription(),
                expedient.getStatus(),
                expedient.getMetadata(),
                expedient.getClosedAt(),
                expedient.getArchivedAt(),
                expedient.getCreatedAt(),
                expedient.getUpdatedAt());
    }
}
