package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ComponentPermissionDtos.FormMatrixResponse;
import com.lta.gestdocum.backend.dto.ComponentPermissionDtos.FormResponse;
import com.lta.gestdocum.backend.dto.ComponentPermissionDtos.UpdateFormMatrixRequest;
import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.service.ComponentPermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/component-permissions")
@Tag(name = "Privilegios por componente", description = "Estados de cada componente de formulario por grupo")
public class ComponentPermissionController {

    private final ComponentPermissionService service;

    public ComponentPermissionController(ComponentPermissionService service) {
        this.service = service;
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Estados efectivos del usuario en un formulario",
            description = "Si el usuario tiene varios grupos gana el estado más permisivo; sin configuración, VISIBLE_EDITABLE")
    public Map<String, ComponentState> mine(@RequestParam String form) {
        return service.myStates(form);
    }

    @GetMapping("/forms")
    @PreAuthorize("hasAuthority('component_permission:manage')")
    @Operation(summary = "Catálogo de formularios y componentes configurables")
    public List<FormResponse> forms() {
        return service.forms();
    }

    @GetMapping("/roles/{roleId}")
    @PreAuthorize("hasAuthority('component_permission:manage')")
    @Operation(summary = "Matriz de estados de un grupo en un formulario")
    public FormMatrixResponse matrix(@PathVariable Long roleId, @RequestParam String form) {
        return service.matrix(roleId, form);
    }

    @PutMapping("/roles/{roleId}")
    @PreAuthorize("hasAuthority('component_permission:manage')")
    @Operation(summary = "Guardar la matriz de estados de un grupo en un formulario")
    public FormMatrixResponse save(@PathVariable Long roleId, @RequestParam String form,
                                   @Valid @RequestBody UpdateFormMatrixRequest request) {
        return service.saveMatrix(roleId, form, request.states());
    }
}
