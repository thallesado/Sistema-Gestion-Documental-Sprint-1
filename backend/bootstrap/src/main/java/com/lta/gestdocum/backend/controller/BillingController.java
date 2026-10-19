package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.service.BillingService;
import com.lta.gestdocum.backend.billing.StripeWebhookVerifier;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {
    private final BillingService billing;
    private final StripeWebhookVerifier stripeWebhookVerifier;
    public BillingController(BillingService billing, StripeWebhookVerifier stripeWebhookVerifier) {
        this.billing = billing;
        this.stripeWebhookVerifier = stripeWebhookVerifier;
    }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/checkout/initiate") public BillingCheckoutResponse initiate(@Valid @RequestBody BillingCheckoutRequest request) { return billing.initiate(request); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/checkout/confirm") public BillingOverviewResponse confirm(@Valid @RequestBody BillingConfirmRequest request) { return billing.confirm(request); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @GetMapping("/my-invoices") public BillingOverviewResponse invoices() { return billing.overviewForCurrentTenant(); }
    @GetMapping("/revenue-dashboard") public RevenueDashboardResponse revenue() { return billing.revenueDashboard(); }
    @PostMapping("/webhooks/stripe")
    public ResponseEntity<Void> stripeWebhook(@RequestHeader("Stripe-Signature") String signature,
                                              @RequestBody String payload) {
        stripeWebhookVerifier.verify(payload, signature);
        billing.confirmStripeWebhook(payload);
        return ResponseEntity.ok().build();
    }
}
