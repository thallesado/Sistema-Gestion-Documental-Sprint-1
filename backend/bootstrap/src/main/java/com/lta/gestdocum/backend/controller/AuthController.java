package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AuthRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.UserResponse;
import com.lta.gestdocum.backend.dto.RefreshTokenRequest;
import com.lta.gestdocum.backend.security.AuthenticatedUser;
import com.lta.gestdocum.backend.service.AuthenticationAuditService;
import com.lta.gestdocum.backend.service.AuthService;
import com.lta.gestdocum.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Autenticación", description = "Endpoint para iniciar sesión y obtener Token JWT")
public class AuthController {
    private final AuthService authService;
    private final UserService userService;
    private final AuthenticationAuditService authenticationAuditService;

    public AuthController(AuthService authService, UserService userService,
                          AuthenticationAuditService authenticationAuditService) {
        this.authService = authService;
        this.userService = userService;
        this.authenticationAuditService = authenticationAuditService;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar Sesión", description = "Autentica al usuario y retorna token JWT")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request,
                                              HttpServletRequest httpRequest) {
        AuthResponse response = authService.login(request);
        authenticationAuditService.recordSuccessfulAuthentication(response, httpRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Renovar sesión", description = "Emite un nuevo JWT de acceso usando un refresh token válido")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request,
                                                HttpServletRequest httpRequest) {
        AuthResponse response = authService.refresh(request);
        authenticationAuditService.recordSuccessfulAuthentication(response, httpRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "Cerrar sesión", description = "Revoca persistentemente el access token actual")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> logout(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) RefreshTokenRequest request) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            authService.logout(authenticatedUser, authorization.substring(7),
                    request == null ? null : request.getRefreshToken());
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    @Operation(summary = "Usuario autenticado", description = "Devuelve la identidad del usuario autenticado dentro de su tenant")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserResponse> me() {
        return ResponseEntity.ok(userService.getCurrentUser());
    }

}