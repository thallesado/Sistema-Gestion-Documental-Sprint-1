package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ComponentPermissionDtos.FormMatrixResponse;
import com.lta.gestdocum.backend.dto.ComponentPermissionDtos.FormResponse;
import com.lta.gestdocum.backend.exception.NotFoundException;
import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository;
import com.lta.gestdocum.backend.repository.RoleRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Privilegios por componente de formulario (B2): estados efectivos y administración de la matriz por grupo. */
@Service
public class ComponentPermissionService {

    private final ComponentPermissionRepository repository;
    private final RoleRepository roleRepository;
    private final AuthenticatedUserContext context;

    public ComponentPermissionService(ComponentPermissionRepository repository, RoleRepository roleRepository,
                                      AuthenticatedUserContext context) {
        this.repository = repository;
        this.roleRepository = roleRepository;
        this.context = context;
    }

    /**
     * Estados efectivos del usuario actual. Debe llamarse dentro de una transacción; vuelve a
     * establecer el contexto RLS, lo que es inocuo si el servicio que la usa ya lo hizo.
     */
    @Transactional(readOnly = true)
    public ComponentFormAccess current(String formKey) {
        ComponentFormCatalog.Form form = ComponentFormCatalog.require(formKey);
        UUID tenantId = context.require().tenantId();
        if (tenantId == null) return ComponentFormAccess.unrestricted(form);
        context.establishDatabaseContext();
        List<Long> roleIds = repository.currentRoleIds();
        return ComponentFormAccess.resolve(form, roleIds, repository.findByRoles(tenantId, formKey, roleIds));
    }

    @Transactional(readOnly = true)
    public Map<String, ComponentState> myStates(String formKey) {
        return new LinkedHashMap<>(current(formKey).states());
    }

    public List<FormResponse> forms() {
        return ComponentFormCatalog.forms().stream().map(FormResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public FormMatrixResponse matrix(Long roleId, String formKey) {
        ComponentFormCatalog.Form form = ComponentFormCatalog.require(formKey);
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        requireRole(roleId, tenantId);
        Map<String, ComponentState> stored = repository.findByRole(tenantId, formKey, roleId);
        Map<String, ComponentState> states = new LinkedHashMap<>();
        form.components().forEach(c -> states.put(c.key(), stored.getOrDefault(c.key(), ComponentState.DEFAULT)));
        return new FormMatrixResponse(roleId, formKey, states);
    }

    @Transactional
    public FormMatrixResponse saveMatrix(Long roleId, String formKey, Map<String, ComponentState> states) {
        ComponentFormCatalog.Form form = ComponentFormCatalog.require(formKey);
        if (states == null) throw new IllegalArgumentException("La matriz de estados es obligatoria");
        states.forEach((componentKey, state) -> {
            if (!form.has(componentKey)) {
                throw new IllegalArgumentException("Componente desconocido en " + formKey + ": " + componentKey);
            }
            if (state == null) throw new IllegalArgumentException("Estado vacío para " + componentKey);
        });
        UUID tenantId = context.requireTenantId();
        context.establishDatabaseContext();
        requireRole(roleId, tenantId);
        repository.replace(tenantId, formKey, roleId, states, context.requireUserId());
        return matrix(roleId, formKey);
    }

    private void requireRole(Long roleId, UUID tenantId) {
        if (roleId == null || roleRepository.findByIdAndTenantId(roleId, tenantId).isEmpty()) {
            throw new NotFoundException("Grupo no encontrado");
        }
    }
}
