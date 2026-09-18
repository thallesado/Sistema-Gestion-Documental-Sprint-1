package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.UserCreateRequest;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.UserUpdateRequest;
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

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user:read')")
    @Operation(summary = "Listar usuarios", description = "Lista usuarios activos del tenant autenticado con paginación y filtro opcional")
    public ResponseEntity<Page<UserResponse>> findUsers(
            @RequestParam(required = false) String filter,
            Pageable pageable) {
        return ResponseEntity.ok(userService.findUsers(filter, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user:create')")
    @Operation(summary = "Crear Usuario", description = "Registra un nuevo usuario asignándole un perfil de personal clínico (Doctor, Enfermero, etc.)")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(request));
    }
/* 
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user:update')")
    @PreAuthorize("hasAuthority('user:update')")
    @Operation(summary = "Actualizar Usuario", description = "Actualiza los datos del usuario y su especialidad médica")
    public ResponseEntity<UserResponse> updateUser(@PathVariable UUID id, @RequestBody UserCreateRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }*/
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user:update')")
    @Operation(summary = "Actualizar Usuario", description = "Actualiza los datos del usuario y su especialidad médica")
    public ResponseEntity<UserResponse> updateUser(
        @PathVariable UUID id, 
        @Valid @RequestBody UserUpdateRequest request) {
    return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user:delete')")
    @Operation(summary = "Eliminar Usuario (Soft Delete)", description = "Realiza la baja lógica asignando valor a la columna deleted_at")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
