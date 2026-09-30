package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ExpedientTypeResponse;
import com.lta.gestdocum.backend.repository.ExpedientTypeRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpedientTypeService {
    private final ExpedientTypeRepository repository;
    private final AuthenticatedUserContext userContext;

    public ExpedientTypeService(ExpedientTypeRepository repository, AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<ExpedientTypeResponse> find(Pageable pageable) {
        var tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return repository.findByTenantIdAndActiveTrueOrderByNameAsc(tenantId, pageable)
                .map(type -> new ExpedientTypeResponse(type.getId(), type.getName(), type.getCode()));
    }
}
