package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository;
import org.springframework.security.access.AccessDeniedException;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Estados efectivos de un formulario para el usuario actual y reglas que los servicios aplican
 * en el servidor: ocultar en lecturas y rechazar escrituras sobre componentes no editables.
 */
public record ComponentFormAccess(ComponentFormCatalog.Form form, Map<String, ComponentState> states) {

    public ComponentFormAccess {
        states = Map.copyOf(states);
    }

    /** Sin grupos o sin tenant (cuentas de plataforma): todo editable, la autorización la siguen dando los permisos. */
    public static ComponentFormAccess unrestricted(ComponentFormCatalog.Form form) {
        return resolve(form, List.of(), List.of());
    }

    /**
     * Para cada componente gana el estado más permisivo entre los grupos del usuario. Un grupo sin
     * fila para el componente aporta {@link ComponentState#DEFAULT}, así que basta con que uno de
     * los grupos no lo restrinja para que quede editable.
     */
    public static ComponentFormAccess resolve(ComponentFormCatalog.Form form, Collection<Long> roleIds,
                                              List<ComponentPermissionRepository.Row> rows) {
        Map<Long, Map<String, ComponentState>> byRole = new HashMap<>();
        rows.forEach(row -> byRole.computeIfAbsent(row.roleId(), id -> new HashMap<>()).put(row.componentKey(), row.state()));
        Map<String, ComponentState> effective = new LinkedHashMap<>();
        for (ComponentFormCatalog.Component component : form.components()) {
            ComponentState state = roleIds.isEmpty() ? ComponentState.DEFAULT : ComponentState.HIDDEN;
            for (Long roleId : roleIds) {
                ComponentState roleState = byRole.getOrDefault(roleId, Map.of())
                        .getOrDefault(component.key(), ComponentState.DEFAULT);
                state = ComponentState.mostPermissive(state, roleState);
            }
            effective.put(component.key(), state);
        }
        return new ComponentFormAccess(form, effective);
    }

    public ComponentState state(String componentKey) {
        return states.getOrDefault(componentKey, ComponentState.DEFAULT);
    }

    public boolean visible(String componentKey) {
        return state(componentKey).isVisible();
    }

    public boolean editable(String componentKey) {
        return state(componentKey).isEditable();
    }

    /** Valor para una respuesta: los componentes ocultos no se devuelven. */
    public <T> T reveal(String componentKey, T value) {
        return visible(componentKey) ? value : null;
    }

    /** Alta: un componente no editable no puede llegar informado. */
    public void requireEditableIfProvided(String componentKey, Object requested) {
        if (isProvided(requested) && !editable(componentKey)) deny(componentKey);
    }

    /** Edición: un componente no editable solo se acepta si llega vacío o con el valor actual. */
    public void requireUnchanged(String componentKey, Object current, Object requested) {
        if (isProvided(requested) && !editable(componentKey) && !sameValue(current, requested)) deny(componentKey);
    }

    private void deny(String componentKey) {
        String label = form.components().stream().filter(component -> component.key().equals(componentKey))
                .map(ComponentFormCatalog.Component::label).findFirst().orElse(componentKey);
        throw new AccessDeniedException("Tu perfil no puede modificar el campo '" + label + "' ("
                + form.key() + "." + componentKey + ")");
    }

    private static boolean isProvided(Object value) {
        if (value instanceof String text) return !text.isBlank();
        if (value instanceof Collection<?> collection) return !collection.isEmpty();
        return value != null;
    }

    private static boolean sameValue(Object current, Object requested) {
        if (current instanceof String a && requested instanceof String b) return a.trim().equalsIgnoreCase(b.trim());
        if (current instanceof Enum<?> e && requested instanceof String text) return e.name().equalsIgnoreCase(text.trim());
        return Objects.equals(current, requested);
    }
}
