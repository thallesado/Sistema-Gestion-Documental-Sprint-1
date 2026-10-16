package com.lta.gestdocum.backend.billing;

import com.lta.gestdocum.backend.model.BillingTransaction;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Adapter boundary: production providers may replace these sandbox beans without touching billing rules. */
public interface PaymentGatewayProvider {
    BillingTransaction.PaymentMethod method();
    GatewayPayment initiate(UUID transactionId, BigDecimal amountUsd, BillingTransaction.BillingCycle cycle, String network);
    boolean confirm(String externalReference, String confirmationReference);

    /** Real Stripe payments are settled only from a signed webhook. */
    default boolean requiresWebhook() { return false; }

    record GatewayPayment(String externalReference, Instant expiresAt, Map<String, Object> payload) { }
}
