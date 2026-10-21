package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PublicSignupRequest;
import com.lta.gestdocum.backend.dto.PublicSignupResponse;
import com.lta.gestdocum.backend.service.PublicSignupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/public")
public class PublicSignupController {

    private final PublicSignupService signupService;

    public PublicSignupController(PublicSignupService signupService) {
        this.signupService = signupService;
    }

    /**
     * Endpoint público para alta de empresa con contratación y pago simulado (A3).
     */
    @PostMapping("/signup")
    public ResponseEntity<PublicSignupResponse> signup(@Valid @RequestBody PublicSignupRequest request) {
        PublicSignupResponse response = signupService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
