package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.UserCreateRequest;
import com.lta.gestdocum.backend.dto.UserCustomizationDtos.UserCustomizationRequest;
import com.lta.gestdocum.backend.dto.UserCustomizationDtos.UserCustomizationResponse;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
import com.lta.gestdocum.backend.service.UserCustomizationService;
import com.lta.gestdocum.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Gestión de Usuarios", description = "CRUD de usuarios y asignación de perfil clínico (Admin, Doctor, Enfermero)")
@SecurityRequirement(name = "BearerAuth")
public class UserController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(UserController.class);

    private final UserService userService;
    private final UserCustomizationService userCustomizationService;

    public UserController(UserService userService, UserCustomizationService userCustomizationService) {
        this.userService = userService;
        this.userCustomizationService = userCustomizationService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user:read')")
    @Operation(summary = "Listar usuarios", description = "Lista usuarios activos del tenant autenticado con paginación y filtro opcional")
    public ResponseEntity<Page<UserResponse>> findUsers(
            @RequestParam(required = false) String filter,
            Pageable pageable) {
        return ResponseEntity.ok(userService.findUsers(filter, pageable));
    }

    @GetMapping("/responsible")
    @PreAuthorize("hasAuthority('user:read') or hasAuthority('expedient:create')")
    @Operation(summary = "Listar responsables disponibles",
            description = "Usuarios activos del tenant autenticado con rol clínico o permiso para gestionar expedientes")
    public ResponseEntity<Page<UserResponse>> findResponsibleUsers(
            @RequestParam(required = false) String filter,
            Pageable pageable) {
        return ResponseEntity.ok(userService.findResponsibleUsers(filter, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user:create')")
    @Operation(summary = "Crear Usuario", description = "Registra un nuevo usuario asignándole un perfil de personal clínico (Doctor, Enfermero, etc.)")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) {
        // TEMPORAL (traza): DTO recibido, sin la contraseña
        log.info("[CREATE-USER] DTO recibido: tenantId={}, username={}, email={}, firstName={}, lastName={}, "
                        + "staffType={}, specialty={}, professionalLicense={}, roleIds={}, passwordLength={}",
                request.getTenantId(), request.getUsername(), request.getEmail(), request.getFirstName(),
                request.getLastName(), request.getStaffType(), request.getSpecialty(),
                request.getProfessionalLicense(), request.getRoleIds(),
                request.getPassword() == null ? null : request.getPassword().length());
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(request));
    }
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user:update')")
    @Operation(summary = "Actualizar Usuario", description = "Actualiza los datos del usuario y su especialidad médica")
    public ResponseEntity<UserResponse> updateUser(
        @PathVariable UUID id, 
        @Valid @RequestBody UserUpdateRequest request) {
    return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @GetMapping("/{id}/customization")
    @PreAuthorize("hasAuthority('user:customize') and hasAuthority('user:read')")
    @Operation(summary = "Consultar personalización", description = "Perfil, interfaz, notificaciones, acceso y límites documentales del usuario")
    public ResponseEntity<UserCustomizationResponse> getCustomization(@PathVariable UUID id) {
        return ResponseEntity.ok(userCustomizationService.get(id));
    }

    @PutMapping("/{id}/customization")
    @PreAuthorize("hasAuthority('user:customize') and hasAuthority('user:read')")
    @Operation(summary = "Personalizar usuario", description = "Guarda la personalización; si cambia el acceso se cierran sus sesiones")
    public ResponseEntity<UserCustomizationResponse> updateCustomization(
            @PathVariable UUID id,
            @Valid @RequestBody UserCustomizationRequest request) {
        return ResponseEntity.ok(userCustomizationService.update(id, request));
    }

    @PostMapping("/{id}/sessions/revoke")
    @PreAuthorize("hasAuthority('user:customize') and hasAuthority('user:read')")
    @Operation(summary = "Cerrar sesiones del usuario", description = "Revoca todas las sesiones abiertas del usuario")
    public ResponseEntity<Void> revokeSessions(@PathVariable UUID id) {
        userCustomizationService.revokeSessions(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user:delete')")
    @Operation(summary = "Eliminar Usuario (Soft Delete)", description = "Realiza la baja lógica asignando valor a la columna deleted_at")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
