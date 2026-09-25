package com.lta.gestdocum.backend.modulos.organizaciones.servicio;

import com.lta.gestdocum.backend.modulos.organizaciones.dto.RoleResponse;
import com.lta.gestdocum.backend.modulos.organizaciones.repositorio.RoleRepository;
import com.lta.gestdocum.backend.comun.seguridad.AuthenticatedUserContext;
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
