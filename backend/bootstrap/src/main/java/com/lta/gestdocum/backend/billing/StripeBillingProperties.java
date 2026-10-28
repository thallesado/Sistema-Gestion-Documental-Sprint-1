package com.lta.gestdocum.backend.billing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Stripe Billing settings. The browser only sends a plan code and cycle; the recurring
 * {@code price_...} is always resolved here so a client cannot pick a cheaper price.
 *
 * <p>Desde la migración 063 el precio vigente sale de {@code plan_prices} (versión no archivada con
 * {@code stripe_price_id}); las variables {@code app.stripe.prices.*} quedan como respaldo mientras
 * un plan no tenga versión creada en Stripe desde el catálogo.
 */
@Component
public class StripeBillingProperties {
    private static final Logger log = LoggerFactory.getLogger(StripeBillingProperties.class);
    public static final String API_KEY_PLACEHOLDER = "rk_test_REPLACE_WITH_YOUR_KEY";
    private static final List<String> PLAN_CODES = List.of("BASIC", "PRO", "ENTERPRISE");
    private static final List<String> CYCLES = List.of("MONTHLY", "ANNUAL");

    private final String apiKey;
    private final String frontendUrl;
    private final Environment environment;
    private final JdbcTemplate jdbc;

    @Autowired
    public StripeBillingProperties(@Value("${app.stripe.api-key:" + API_KEY_PLACEHOLDER + "}") String apiKey,
                                   @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl,
                                   Environment environment, ObjectProvider<JdbcTemplate> jdbcProvider) {
        this.apiKey = apiKey;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        this.environment = environment;
        this.jdbc = jdbcProvider == null ? null : jdbcProvider.getIfAvailable();
    }

    public StripeBillingProperties(String apiKey, String frontendUrl, Environment environment) {
        this(apiKey, frontendUrl, environment, null);
    }

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank() && !API_KEY_PLACEHOLDER.equals(apiKey);
    }

    String apiKey() { return apiKey; }

    public String frontendUrl() { return frontendUrl; }

    /** Precio vigente para nuevas ventas: catálogo versionado primero, variables de entorno como respaldo. */
    public Optional<String> priceFor(String planCode, String cycle) {
        Optional<String> catalog = query("""
                select pp.stripe_price_id from plan_prices pp join plans p on p.id = pp.plan_id
                where upper(p.code) = ? and pp.billing_cycle = ? and pp.archived_at is null and pp.stripe_price_id is not null
                """, planCode.toUpperCase(Locale.ROOT), cycle.toUpperCase(Locale.ROOT))
                .map(row -> (String) row.get("stripe_price_id"));
        return catalog.isPresent() ? catalog : environmentPriceFor(planCode, cycle);
    }

    /** Precio configurado en app.stripe.prices.*; lo usa el catálogo al crear la primera versión en Stripe. */
    public Optional<String> environmentPriceFor(String planCode, String cycle) {
        String value = environment.getProperty("app.stripe.prices." + planCode.toLowerCase(Locale.ROOT)
                + "-" + cycle.toLowerCase(Locale.ROOT), "").trim();
        return value.startsWith("price_") ? Optional.of(value) : Optional.empty();
    }

    /**
     * Inverse lookup used to follow plan changes made in the Stripe Billing Portal. Incluye versiones
     * archivadas: una suscripción con un precio antiguo sigue perteneciendo a su plan.
     */
    public Optional<PlanPrice> planForPrice(String priceId) {
        if (priceId == null || priceId.isBlank()) return Optional.empty();
        Optional<PlanPrice> catalog = query("""
                select p.code, pp.billing_cycle from plan_prices pp join plans p on p.id = pp.plan_id
                where pp.stripe_price_id = ?
                """, priceId).map(row -> new PlanPrice(((String) row.get("code")).toUpperCase(Locale.ROOT),
                (String) row.get("billing_cycle")));
        if (catalog.isPresent()) return catalog;
        for (String code : PLAN_CODES) {
            for (String cycle : CYCLES) {
                if (environmentPriceFor(code, cycle).filter(priceId::equals).isPresent()) return Optional.of(new PlanPrice(code, cycle));
            }
        }
        return Optional.empty();
    }

    private Optional<Map<String, Object>> query(String sql, Object... args) {
        if (jdbc == null) return Optional.empty();
        try {
            return jdbc.queryForList(sql, args).stream().findFirst();
        } catch (DataAccessException exception) {
            // Base sin la migración 063: se mantiene el comportamiento por variables de entorno.
            log.debug("Catálogo de precios no disponible: {}", exception.getMessage());
            return Optional.empty();
        }
    }

    public record PlanPrice(String planCode, String cycle) { }
}
