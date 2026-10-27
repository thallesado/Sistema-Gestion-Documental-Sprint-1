package com.lta.gestdocum.backend.billing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Stripe Billing settings. The browser only sends a plan code and cycle; the recurring
 * {@code price_...} is always resolved here so a client cannot pick a cheaper price.
 */
@Component
public class StripeBillingProperties {
    public static final String API_KEY_PLACEHOLDER = "rk_test_REPLACE_WITH_YOUR_KEY";
    private static final List<String> PLAN_CODES = List.of("BASIC", "PRO", "ENTERPRISE");
    private static final List<String> CYCLES = List.of("MONTHLY", "ANNUAL");

    private final String apiKey;
    private final String frontendUrl;
    private final Environment environment;

    public StripeBillingProperties(@Value("${app.stripe.api-key:" + API_KEY_PLACEHOLDER + "}") String apiKey,
                                   @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl,
                                   Environment environment) {
        this.apiKey = apiKey;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        this.environment = environment;
    }

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank() && !API_KEY_PLACEHOLDER.equals(apiKey);
    }

    String apiKey() { return apiKey; }

    public String frontendUrl() { return frontendUrl; }

    public Optional<String> priceFor(String planCode, String cycle) {
        String value = environment.getProperty("app.stripe.prices." + planCode.toLowerCase(Locale.ROOT)
                + "-" + cycle.toLowerCase(Locale.ROOT), "").trim();
        return value.startsWith("price_") ? Optional.of(value) : Optional.empty();
    }

    /** Inverse lookup used to follow plan changes made in the Stripe Billing Portal. */
    public Optional<PlanPrice> planForPrice(String priceId) {
        if (priceId == null || priceId.isBlank()) return Optional.empty();
        for (String code : PLAN_CODES) {
            for (String cycle : CYCLES) {
                if (priceFor(code, cycle).filter(priceId::equals).isPresent()) return Optional.of(new PlanPrice(code, cycle));
            }
        }
        return Optional.empty();
    }

    public record PlanPrice(String planCode, String cycle) { }
}
