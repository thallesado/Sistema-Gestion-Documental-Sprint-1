package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.billing.StripeBillingProperties;
import com.lta.gestdocum.backend.dto.PublicSignupRequest;
import com.lta.gestdocum.backend.dto.PublicSignupResponse;
import com.lta.gestdocum.backend.service.PublicSignupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/public")
public class PublicSignupController {

    private final PublicSignupService signupService;
    private final StripeBillingProperties stripe;

    public PublicSignupController(PublicSignupService signupService, StripeBillingProperties stripe) {
        this.signupService = signupService;
        this.stripe = stripe;
    }

    /**
     * Endpoint público para alta de empresa con contratación y pago simulado (A3). Con Stripe
     * configurado se desactiva: activaría una organización de pago sin cobro real.
     */
    @PostMapping("/signup")
    public ResponseEntity<PublicSignupResponse> signup(@Valid @RequestBody PublicSignupRequest request) {
        if (stripe.configured()) {
            throw new ResponseStatusException(HttpStatus.GONE,
                    "El pago simulado está desactivado; usa /api/v1/public/subscriptions/checkout");
        }
        PublicSignupResponse response = signupService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
