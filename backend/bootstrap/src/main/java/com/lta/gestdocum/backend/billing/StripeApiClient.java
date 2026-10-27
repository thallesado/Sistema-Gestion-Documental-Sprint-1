package com.lta.gestdocum.backend.billing;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;

/** Minimal form-encoded client for the Stripe endpoints used by subscription billing. */
@Component
public class StripeApiClient {
    private final StripeBillingProperties properties;
    private final RestClient stripeClient;

    public StripeApiClient(StripeBillingProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.stripeClient = restClientBuilder.baseUrl("https://api.stripe.com").build();
    }

    public JsonNode createCheckoutSession(Map<String, String> form, String idempotencyKey) {
        return post("/v1/checkout/sessions", form, idempotencyKey);
    }

    public JsonNode createPortalSession(String customerId, String returnUrl) {
        return post("/v1/billing_portal/sessions", Map.of("customer", customerId, "return_url", returnUrl), null);
    }

    public JsonNode retrieveCheckoutSession(String sessionId) { return get("/v1/checkout/sessions/{id}", sessionId); }

    public JsonNode retrieveSubscription(String subscriptionId) { return get("/v1/subscriptions/{id}", subscriptionId); }

    public JsonNode retrieveInvoice(String invoiceId) { return get("/v1/invoices/{id}", invoiceId); }

    private JsonNode post(String path, Map<String, String> form, String idempotencyKey) {
        requireConfigured();
        String body = form.entrySet().stream()
                .map(e -> encode(e.getKey()) + "=" + encode(e.getValue()))
                .collect(Collectors.joining("&"));
        JsonNode result = stripeClient.post().uri(path)
                .headers(headers -> {
                    headers.setBasicAuth(properties.apiKey(), "");
                    if (idempotencyKey != null) headers.set("Idempotency-Key", idempotencyKey);
                })
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(body)
                .retrieve().body(JsonNode.class);
        if (result == null || result.path("id").asText().isBlank()) {
            throw new IllegalStateException("Stripe no devolvió una respuesta válida");
        }
        return result;
    }

    private JsonNode get(String path, String id) {
        requireConfigured();
        JsonNode result = stripeClient.get().uri(path, id)
                .headers(headers -> headers.setBasicAuth(properties.apiKey(), ""))
                .retrieve().body(JsonNode.class);
        if (result == null) throw new IllegalStateException("Stripe no devolvió una respuesta válida");
        return result;
    }

    private void requireConfigured() {
        if (!properties.configured()) throw new IllegalStateException("Los pagos con Stripe no están configurados");
    }

    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
