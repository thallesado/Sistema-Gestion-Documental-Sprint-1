package com.lta.gestdocum.backend.dto;

import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.service.ComponentFormCatalog;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

/** Contratos de /api/v1/component-permissions. */
public final class ComponentPermissionDtos {

    private ComponentPermissionDtos() {
    }

    public record ComponentResponse(String key, String label) { }

    public record FormResponse(String key, String label, List<ComponentResponse> components) {
        public static FormResponse from(ComponentFormCatalog.Form form) {
            return new FormResponse(form.key(), form.label(), form.components().stream()
                    .map(component -> new ComponentResponse(component.key(), component.label())).toList());
        }
    }

    /** Estados de todos los componentes del formulario para un grupo. */
    public record FormMatrixResponse(Long roleId, String form, Map<String, ComponentState> states) { }

    public record UpdateFormMatrixRequest(@NotNull Map<String, ComponentState> states) { }
}
