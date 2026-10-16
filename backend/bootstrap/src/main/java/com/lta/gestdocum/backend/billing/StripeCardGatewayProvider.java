package com.lta.gestdocum.backend.billing;

import com.lta.gestdocum.backend.model.BillingTransaction;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClient;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class StripeCardGatewayProvider implements PaymentGatewayProvider {
    private final String restrictedApiKey;
    private final RestClient stripeClient;

    public StripeCardGatewayProvider(@Value("${app.stripe.api-key:rk_test_REPLACE_WITH_YOUR_KEY}") String restrictedApiKey,
                                     RestClient.Builder restClientBuilder) {
        this.restrictedApiKey = restrictedApiKey;
        this.stripeClient = restClientBuilder.baseUrl("https://api.stripe.com").build();
    }

    public BillingTransaction.PaymentMethod method() { return BillingTransaction.PaymentMethod.STRIPE_CARD; }
    public GatewayPayment initiate(UUID id, BigDecimal amount, BillingTransaction.BillingCycle cycle, String ignored) {
        if (!requiresWebhook()) {
            String reference = "sandbox_pi_" + id.toString().replace("-", "");
            return new GatewayPayment(reference, Instant.now().plusSeconds(900), Map.of(
                    "clientSecret", reference + "_secret_demo", "mode", "sandbox",
                    "stripeConfigured", false, "amountCents", amount.movePointRight(2).longValueExact()));
        }
        // This adapter deliberately never returns the restricted key. Replacing
        // sandbox branch with the official PaymentIntent API keeps BillingService
        // unchanged and settles only from its signed webhook.
        JsonNode intent = stripeClient.post().uri("/v1/payment_intents")
                .headers(headers -> headers.setBasicAuth(restrictedApiKey, ""))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body("amount=" + amount.movePointRight(2).longValueExact()
                        + "&currency=usd&metadata[transactionId]=" + id)
                .retrieve().body(JsonNode.class);
        if (intent == null || intent.path("id").asText().isBlank() || intent.path("client_secret").asText().isBlank()) {
            throw new IllegalStateException("Stripe no devolvió un PaymentIntent válido");
        }
        return new GatewayPayment(intent.path("id").asText(), Instant.now().plusSeconds(900), Map.of(
                "clientSecret", intent.path("client_secret").asText(), "mode", "stripe",
                "stripeConfigured", true, "amountCents", amount.movePointRight(2).longValueExact()));
    }
    public boolean confirm(String reference, String confirmation) {
        return reference.startsWith("sandbox_pi_") && reference.equals(confirmation);
    }
    @Override public boolean requiresWebhook() { return !restrictedApiKey.equals("rk_test_REPLACE_WITH_YOUR_KEY"); }
}
