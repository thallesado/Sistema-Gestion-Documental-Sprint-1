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

    /** Cambia precio, renovación (cancel_at_period_end) u otros campos de la suscripción. */
    public JsonNode updateSubscription(String subscriptionId, Map<String, String> form) {
        return post("/v1/subscriptions/" + encode(subscriptionId), form, null);
    }

    /** Cancela de inmediato; Stripe emite customer.subscription.deleted. */
    public JsonNode cancelSubscription(String subscriptionId) {
        requireConfigured();
        JsonNode result = stripeClient.delete().uri("/v1/subscriptions/{id}", subscriptionId)
                .headers(headers -> headers.setBasicAuth(properties.apiKey(), ""))
                .retrieve().body(JsonNode.class);
        if (result == null) throw new IllegalStateException("Stripe no devolvió una respuesta válida");
        return result;
    }

    /** Crea un schedule con una fase igual al período actual de la suscripción. */
    public JsonNode createScheduleFromSubscription(String subscriptionId) {
        return post("/v1/subscription_schedules", Map.of("from_subscription", subscriptionId), null);
    }

    public JsonNode updateSchedule(String scheduleId, Map<String, String> form) {
        return post("/v1/subscription_schedules/" + encode(scheduleId), form, null);
    }

    /** Quita el schedule y sus fases futuras; la suscripción sigue igual. */
    public JsonNode releaseSchedule(String scheduleId) {
        return post("/v1/subscription_schedules/" + encode(scheduleId) + "/release", Map.of(), null);
    }

    /** Precio recurrente nuevo (versión de precio del catálogo); los precios de Stripe son inmutables. */
    public JsonNode createPrice(Map<String, String> form, String idempotencyKey) {
        return post("/v1/prices", form, idempotencyKey);
    }

    public JsonNode retrievePrice(String priceId) { return get("/v1/prices/{id}", priceId); }

    /** active=false archiva el precio para nuevas ventas; las suscripciones que lo usan siguen cobrándolo. */
    public JsonNode updatePrice(String priceId, Map<String, String> form) {
        return post("/v1/prices/" + encode(priceId), form, null);
    }

    public JsonNode createProduct(Map<String, String> form, String idempotencyKey) {
        return post("/v1/products", form, idempotencyKey);
    }

    /** Ítem adicional (complemento) en una suscripción existente; se factura en la misma renovación. */
    public JsonNode createSubscriptionItem(Map<String, String> form, String idempotencyKey) {
        return post("/v1/subscription_items", form, idempotencyKey);
    }

    public JsonNode updateSubscriptionItem(String itemId, Map<String, String> form) {
        return post("/v1/subscription_items/" + encode(itemId), form, null);
    }

    /** Quita el ítem; con proration_behavior=none no se reembolsa el período ya pagado. */
    public JsonNode deleteSubscriptionItem(String itemId, String prorationBehavior) {
        requireConfigured();
        JsonNode result = stripeClient.delete()
                .uri(uri -> uri.path("/v1/subscription_items/{id}").queryParam("proration_behavior", prorationBehavior).build(itemId))
                .headers(headers -> headers.setBasicAuth(properties.apiKey(), ""))
                .retrieve().body(JsonNode.class);
        if (result == null) throw new IllegalStateException("Stripe no devolvió una respuesta válida");
        return result;
    }

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
