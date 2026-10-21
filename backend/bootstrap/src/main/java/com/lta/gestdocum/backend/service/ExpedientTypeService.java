package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ExpedientTypeResponse;
import com.lta.gestdocum.backend.dto.ExpedientTypeCreateRequest;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.model.ExpedientType;
import com.lta.gestdocum.backend.repository.ExpedientTypeRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

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

    @Transactional
    public ExpedientTypeResponse create(ExpedientTypeCreateRequest request) {
        var tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String name = request.name().trim().replaceAll("\\s+", " ");
        String code = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (code.isBlank() || code.length() > 50) {
            throw new IllegalArgumentException("El nombre no genera un código de tipo válido");
        }
        if (repository.existsByTenantIdAndCodeIgnoreCase(tenantId, code)) {
            throw new DuplicateResourceException("Ya existe un tipo de expediente con ese nombre");
        }
        var entity = ExpedientType.builder().id(UUID.randomUUID()).tenantId(tenantId)
                .name(name).code(code).active(true).build();
        try {
            var saved = repository.saveAndFlush(entity);
            return new ExpedientTypeResponse(saved.getId(), saved.getName(), saved.getCode());
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateResourceException("Ya existe un tipo de expediente con ese nombre");
        }
    }
}
