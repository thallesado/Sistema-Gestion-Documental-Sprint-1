package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.AuthResponse;
import com.lta.gestdocum.backend.dto.PublicOnboardingRequest;
import com.lta.gestdocum.backend.service.PublicOnboardingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicOnboardingController {
    private final PublicOnboardingService onboarding;
    public PublicOnboardingController(PublicOnboardingService onboarding) { this.onboarding = onboarding; }
    @PostMapping("/onboarding")
    public ResponseEntity<AuthResponse> onboard(@Valid @RequestBody PublicOnboardingRequest request) {
        return ResponseEntity.ok(onboarding.onboard(request));
    }
}
