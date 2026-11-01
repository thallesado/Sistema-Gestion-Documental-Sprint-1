package com.lta.gestdocum.backend.billing;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Ítems de una suscripción de Stripe. Desde los complementos (064) una suscripción puede tener, además del
 * plan, ítems de complementos; se distinguen por {@code metadata.addonCode} del Price (lo fija
 * PlatformAddonService al crearlo). Nunca suponer que el primer ítem es el plan.
 */
public final class SubscriptionItems {
    public static final String ADDON_METADATA = "addonCode";

    private SubscriptionItems() { }

    public static List<JsonNode> all(JsonNode subscription) {
        List<JsonNode> items = new ArrayList<>();
        subscription.path("items").path("data").forEach(items::add);
        return items;
    }

    public static boolean isAddon(JsonNode item) {
        return !item.path("price").path("metadata").path(ADDON_METADATA).asText().isBlank();
    }

    /** Ítem del plan: el primero que no es un complemento (o el primero si la suscripción es antigua). */
    public static JsonNode planItem(JsonNode subscription) {
        List<JsonNode> items = all(subscription);
        return items.stream().filter(item -> !isAddon(item)).findFirst()
                .orElse(items.isEmpty() ? subscription.path("items").path("data").path(0) : items.get(0));
    }

    public static List<JsonNode> addonItems(JsonNode subscription) {
        return all(subscription).stream().filter(SubscriptionItems::isAddon).toList();
    }

    public static String priceId(JsonNode item) {
        JsonNode price = item.path("price");
        return price.isObject() ? price.path("id").asText() : price.asText();
    }

    /**
     * Agrega a la fase de un schedule los ítems de complementos a partir de la posición {@code from}, para
     * que un cambio de plan o de precio no los quite de las facturas siguientes.
     */
    public static void putAddonItems(Map<String, String> form, int phase, int from, List<JsonNode> addonItems) {
        int index = from;
        for (JsonNode item : addonItems) {
            form.put("phases[" + phase + "][items][" + index + "][price]", priceId(item));
            form.put("phases[" + phase + "][items][" + index + "][quantity]", String.valueOf(item.path("quantity").asLong(1)));
            index++;
        }
    }
}
