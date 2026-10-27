package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.PublicSubscriptionCheckoutRequest;
import com.lta.gestdocum.backend.dto.PublicSubscriptionStatusResponse;
import com.lta.gestdocum.backend.dto.SubscriptionCheckoutSessionResponse;
import com.lta.gestdocum.backend.service.StripeSubscriptionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/** Compra directa sin cuenta previa: la organización se crea cuando Stripe confirma el pago. */
@RestController
@RequestMapping("/api/v1/public/subscriptions")
public class PublicSubscriptionController {
    private final StripeSubscriptionService subscriptions;

    public PublicSubscriptionController(StripeSubscriptionService subscriptions) { this.subscriptions = subscriptions; }

    @PostMapping("/checkout")
    public SubscriptionCheckoutSessionResponse checkout(@Valid @RequestBody PublicSubscriptionCheckoutRequest request) {
        return subscriptions.createSignupCheckout(request);
    }

    @GetMapping("/checkout/{sessionId}/status")
    public PublicSubscriptionStatusResponse status(@PathVariable String sessionId) {
        return subscriptions.signupStatus(sessionId);
    }
}
