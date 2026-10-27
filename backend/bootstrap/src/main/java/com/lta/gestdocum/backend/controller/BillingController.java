package com.lta.gestdocum.backend.controller;

import com.lta.gestdocum.backend.dto.*;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionCancelRequest;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionDetailsResponse;
import com.lta.gestdocum.backend.dto.SubscriptionLifecycleDtos.SubscriptionPlanRequest;
import com.lta.gestdocum.backend.service.BillingService;
import com.lta.gestdocum.backend.service.SubscriptionLifecycleService;
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
    private final SubscriptionLifecycleService lifecycle;
    public BillingController(BillingService billing, StripeWebhookVerifier stripeWebhookVerifier,
                             SubscriptionLifecycleService lifecycle) {
        this.billing = billing;
        this.stripeWebhookVerifier = stripeWebhookVerifier;
        this.lifecycle = lifecycle;
    }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/checkout/stripe-sessions/{sessionId}/confirm")
    public java.util.Map<String, Object> confirmStripeCheckout(@PathVariable String sessionId) {
        return java.util.Map.of("status", billing.confirmStripeCheckout(sessionId));
    }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @GetMapping("/subscription") public SubscriptionDetailsResponse subscription() { return lifecycle.details(); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/subscription/upgrade") public SubscriptionDetailsResponse upgrade(@Valid @RequestBody SubscriptionPlanRequest request) { return lifecycle.upgradeNow(request); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/subscription/scheduled-change") public SubscriptionDetailsResponse scheduleChange(@Valid @RequestBody SubscriptionPlanRequest request) { return lifecycle.scheduleChange(request); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @DeleteMapping("/subscription/scheduled-change") public SubscriptionDetailsResponse cancelScheduledChange() { return lifecycle.cancelScheduledChange(); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/subscription/stop-renewal") public SubscriptionDetailsResponse stopRenewal() { return lifecycle.setAutoRenew(false); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/subscription/resume-renewal") public SubscriptionDetailsResponse resumeRenewal() { return lifecycle.setAutoRenew(true); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/subscription/cancel") public java.util.Map<String, Object> cancel(@Valid @RequestBody SubscriptionCancelRequest request) {
        return java.util.Map.of("deletionScheduledAt", lifecycle.cancelNow(request).toString());
    }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/checkout/initiate") public BillingCheckoutResponse initiate(@Valid @RequestBody BillingCheckoutRequest request) { return billing.initiate(request); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/checkout/confirm") public BillingOverviewResponse confirm(@Valid @RequestBody BillingConfirmRequest request) { return billing.confirm(request); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @GetMapping("/my-invoices") public BillingOverviewResponse invoices() { return billing.overviewForCurrentTenant(); }
    @PreAuthorize(PlanController.TENANT_PLAN_ADMIN)
    @PostMapping("/portal") public BillingPortalResponse portal() { return billing.portal(); }
    @GetMapping("/revenue-dashboard") public RevenueDashboardResponse revenue() { return billing.revenueDashboard(); }
    @PostMapping("/webhooks/stripe")
    public ResponseEntity<Void> stripeWebhook(@RequestHeader("Stripe-Signature") String signature,
                                              @RequestBody String payload) {
        stripeWebhookVerifier.verify(payload, signature);
        billing.confirmStripeWebhook(payload);
        return ResponseEntity.ok().build();
    }
}
