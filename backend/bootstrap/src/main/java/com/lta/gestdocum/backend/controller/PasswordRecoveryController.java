package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.ForgotPasswordRequest;
import com.lta.gestdocum.backend.dto.ResetPasswordRequest;
import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.service.AuthenticationAuditService;
import com.lta.gestdocum.backend.service.PasswordRecoveryService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class PasswordRecoveryController {
    private final PasswordRecoveryService passwordRecoveryService;
    private final AuthenticationAuditService authenticationAuditService;

    public PasswordRecoveryController(PasswordRecoveryService passwordRecoveryService,
                                      AuthenticationAuditService authenticationAuditService) {
        this.passwordRecoveryService = passwordRecoveryService;
        this.authenticationAuditService = authenticationAuditService;
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(Map.of("message", passwordRecoveryService.requestRecovery(request)));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<AuthResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request,
                                                       HttpServletRequest httpRequest) {
        AuthResponse response = passwordRecoveryService.resetPassword(request);
        authenticationAuditService.recordSuccessfulAuthentication(response, httpRequest);
        return ResponseEntity.ok(response);
    }
}
