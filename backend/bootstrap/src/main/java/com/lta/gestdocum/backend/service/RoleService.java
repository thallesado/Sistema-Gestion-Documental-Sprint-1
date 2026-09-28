package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.RoleResponse;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoleService {
    private final RoleRepository repository;
    private final AuthenticatedUserContext context;

    public RoleService(RoleRepository repository, AuthenticatedUserContext context) {
        this.repository = repository;
        this.context = context;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> activeRoles() {
        var tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        return repository.findByTenantIdAndIsActiveTrueOrderByNameAsc(tenantId).stream()
                .map(role -> new RoleResponse(role.getId(), role.getName(),
                        role.getDescription(), role.isSystem()))
                .toList();
    }
}
