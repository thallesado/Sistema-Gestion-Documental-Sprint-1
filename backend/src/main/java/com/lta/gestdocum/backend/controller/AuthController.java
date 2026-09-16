package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.service.AuthService;
import com.lta.gestdocum.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Autenticación", description = "Endpoint para iniciar sesión y obtener Token JWT")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    public AuthController(AuthService authService, UserService userService) {
        this.authService = authService;
        this.userService = userService;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar Sesión", description = "Autentica al usuario y retorna token JWT")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    @Operation(summary = "Usuario autenticado", description = "Devuelve la identidad del usuario autenticado dentro de su tenant")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserResponse> me() {
        return ResponseEntity.ok(userService.getCurrentUser());
    }
}