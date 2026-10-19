package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.UserCreateRequest;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
import com.lta.gestdocum.backend.model.User;
import com.lta.gestdocum.backend.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Reglas propias del formulario de usuarios que UserService aplica con una sola llamada por operación.
 *
 * <ul>
 *   <li>B1. Grupo = perfil = rol del tenant: todo usuario de la organización pertenece al menos a
 *   un grupo, porque sus permisos de función salen de los grupos.</li>
 *   <li>B2. Privilegios por componente del formulario {@value ComponentFormCatalog#USER_FORM}: los
 *   componentes no editables no se pueden informar ni cambiar y los ocultos no se devuelven en el listado.</li>
 * </ul>
 */
@Component
public class UserFormPolicy {

    static final String GROUP_REQUIRED = "El usuario debe pertenecer al menos a un grupo (perfil)";

    private final ComponentPermissionService componentPermissions;
    private final RoleRepository roleRepository;

    @Autowired
    public UserFormPolicy(ComponentPermissionService componentPermissions, RoleRepository roleRepository) {
        this.componentPermissions = componentPermissions;
        this.roleRepository = roleRepository;
    }

    /** Solo valida los grupos; para servicios construidos sin Spring (pruebas). */
    public UserFormPolicy() {
        this(null, null);
    }

    public void validateCreate(UserCreateRequest request) {
        requireAtLeastOneGroup(request.getRoleIds());
        ComponentFormAccess access = access();
        access.requireEditableIfProvided("nombre", request.getFirstName());
        access.requireEditableIfProvided("apellido", request.getLastName());
        access.requireEditableIfProvided("usuario", request.getUsername());
        access.requireEditableIfProvided("correo", request.getEmail());
        access.requireEditableIfProvided("contrasena", request.getPassword());
        access.requireEditableIfProvided("grupos", request.getRoleIds());
    }

    /** En la edición {@code roleIds} es opcional (conserva los grupos actuales), pero nunca vacío. */
    public void validateUpdate(User current, UserUpdateRequest request) {
        if (request.getRoleIds() != null) {
            requireAtLeastOneGroup(request.getRoleIds());
        }
        ComponentFormAccess access = access();
        access.requireUnchanged("nombre", current.getFirstName(), request.getFirstName());
        access.requireUnchanged("apellido", current.getLastName(), request.getLastName());
        access.requireUnchanged("correo", current.getEmail(), request.getEmail());
        access.requireUnchanged("estado", current.getStatus(), request.getStatus());
        if (request.getRoleIds() != null && !access.editable("grupos")) {
            Set<Long> currentGroups = roleRepository == null || current.getTenantId() == null
                    ? Set.of() : roleRepository.findIds(current.getTenantId(), current.getId());
            access.requireUnchanged("grupos", currentGroups, request.getRoleIds());
        }
    }

    /** Listado de usuarios: los componentes ocultos para el perfil no salen del servidor. */
    public Page<UserResponse> hideComponents(Page<UserResponse> page) {
        ComponentFormAccess access = access();
        return page.map(user -> {
            user.setFirstName(access.reveal("nombre", user.getFirstName()));
            user.setLastName(access.reveal("apellido", user.getLastName()));
            user.setUsername(access.reveal("usuario", user.getUsername()));
            user.setEmail(access.reveal("correo", user.getEmail()));
            user.setStatus(access.reveal("estado", user.getStatus()));
            user.setRoleIds(access.reveal("grupos", user.getRoleIds()));
            user.setRoleNames(access.reveal("grupos", user.getRoleNames()));
            return user;
        });
    }

    private ComponentFormAccess access() {
        return componentPermissions == null
                ? ComponentFormAccess.unrestricted(ComponentFormCatalog.require(ComponentFormCatalog.USER_FORM))
                : componentPermissions.current(ComponentFormCatalog.USER_FORM);
    }

    private void requireAtLeastOneGroup(Set<Long> roleIds) {
        if (roleIds == null || roleIds.isEmpty() || roleIds.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException(GROUP_REQUIRED);
        }
    }
}
