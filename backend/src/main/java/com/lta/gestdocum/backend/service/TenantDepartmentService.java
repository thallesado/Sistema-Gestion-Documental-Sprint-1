package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.TenantDepartmentRequest;
import com.lta.gestdocum.backend.dto.TenantDepartmentResponse;
import com.lta.gestdocum.backend.exception.DuplicateResourceException;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.TenantDepartment;
import com.lta.gestdocum.backend.repository.TenantDepartmentRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import com.lta.gestdocum.backend.support.CrudTextSupport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class TenantDepartmentService {

    private final TenantDepartmentRepository repository;
    private final AuthenticatedUserContext userContext;

    public TenantDepartmentService(
            TenantDepartmentRepository repository,
            AuthenticatedUserContext userContext) {
        this.repository = repository;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public Page<TenantDepartmentResponse> find(String filter, Boolean active, Pageable pageable) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        return repository.findByTenant(tenantId, CrudTextSupport.optionalFilter(filter), active, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TenantDepartmentResponse findById(UUID id) {
        userContext.establishDatabaseContext();
        return toResponse(getForTenant(id));
    }

    @Transactional
    public TenantDepartmentResponse create(TenantDepartmentRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        String name = CrudTextSupport.required(request.getName(), "name");
        String code = CrudTextSupport.required(request.getCode(), "code");
        ensureUnique(tenantId, code, name, null);

        OffsetDateTime now = OffsetDateTime.now();
        TenantDepartment department = TenantDepartment.builder()
                .tenantId(tenantId)
                .name(name)
                .code(code)
                .description(trimToNull(request.getDescription()))
                .active(request.getActive() == null || request.getActive())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(department));
    }

    @Transactional
    public TenantDepartmentResponse update(UUID id, TenantDepartmentRequest request) {
        UUID tenantId = userContext.requireTenantId();
        userContext.establishDatabaseContext();
        TenantDepartment department = getForTenant(id);
        String name = request.getName() == null
                ? department.getName()
                : CrudTextSupport.required(request.getName(), "name");
        String code = request.getCode() == null
                ? department.getCode()
                : CrudTextSupport.required(request.getCode(), "code");
        ensureUnique(tenantId, code, name, id);

        department.setName(name);
        department.setCode(code);
        if (request.getDescription() != null) {
            department.setDescription(trimToNull(request.getDescription()));
        }
        if (request.getActive() != null) {
            department.setActive(request.getActive());
        }
        department.setUpdatedAt(OffsetDateTime.now());
        return toResponse(repository.save(department));
    }

    @Transactional
    public void deactivate(UUID id) {
        userContext.establishDatabaseContext();
        TenantDepartment department = getForTenant(id);
        department.setActive(false);
        department.setUpdatedAt(OffsetDateTime.now());
        repository.save(department);
    }

    private TenantDepartment getForTenant(UUID id) {
        return repository.findByIdAndTenantId(id, userContext.requireTenantId())
                .orElseThrow(() -> new NotFoundException("Departamento no encontrado"));
    }

    private void ensureUnique(UUID tenantId, String code, String name, UUID excludedId) {
        if (repository.existsDuplicate(tenantId, code, name, excludedId)) {
            throw new DuplicateResourceException("El código o nombre del departamento ya existe");
        }
    }

    private TenantDepartmentResponse toResponse(TenantDepartment department) {
        return TenantDepartmentResponse.builder()
                .id(department.getId())
                .name(department.getName())
                .code(department.getCode())
                .description(department.getDescription())
                .active(department.isActive())
                .createdAt(department.getCreatedAt())
                .updatedAt(department.getUpdatedAt())
                .build();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
