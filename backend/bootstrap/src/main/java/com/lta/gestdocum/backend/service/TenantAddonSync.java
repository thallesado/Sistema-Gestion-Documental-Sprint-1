package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lta.gestdocum.backend.billing.SubscriptionItems;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/**
 * Refleja en tenant_addons los ítems de complementos de una suscripción de Stripe (064). Stripe es la
 * fuente de verdad del cobro: subir unidades rige de inmediato; bajar o quitar rige al final del período
 * pagado (pending_units/pending_at), igual que el resto del ciclo de vida. Escribe con el usuario de
 * conexión, como los webhooks de 059.
 */
@Component
public class TenantAddonSync {
    private static final Logger log = LoggerFactory.getLogger(TenantAddonSync.class);
    private final JdbcTemplate jdbc;

    public TenantAddonSync(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void sync(UUID tenantId, JsonNode subscription, Instant periodEnd) {
        try {
            boolean canceled = "canceled".equals(subscription.path("status").asText());
            Set<String> seen = new HashSet<>();
            for (JsonNode item : SubscriptionItems.addonItems(subscription)) {
                String itemId = item.path("id").asText();
                seen.add(itemId);
                long quantity = item.path("quantity").asLong(1);
                String code = item.path("price").path("metadata").path(SubscriptionItems.ADDON_METADATA).asText();
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "select id, units, pending_units, status from tenant_addons where stripe_subscription_item_id = ?", itemId);
                if (rows.isEmpty()) {
                    if (canceled || quantity < 1) continue;
                    // Ítem creado fuera del flujo de compra (portal de Stripe o reintento): se registra igual.
                    jdbc.update("""
                            insert into tenant_addons (tenant_id, addon_id, units, source, stripe_subscription_item_id)
                            select ?, a.id, ?, 'PURCHASE', ? from addons a where a.code = ?
                            """, tenantId, (int) quantity, itemId, code);
                    continue;
                }
                apply(rows.get(0), canceled ? 0 : quantity, canceled ? Instant.now() : periodEnd);
            }
            // Ítems que ya no están en la suscripción: el complemento termina al final del período.
            for (Map<String, Object> row : jdbc.queryForList("""
                    select id, units, pending_units, status, stripe_subscription_item_id from tenant_addons
                    where tenant_id = ? and status = 'ACTIVE' and stripe_subscription_item_id is not null
                    """, tenantId)) {
                if (!seen.contains((String) row.get("stripe_subscription_item_id"))) {
                    apply(row, 0, canceled ? Instant.now() : periodEnd);
                }
            }
        } catch (DataAccessException exception) {
            // Base sin 064 o fila inconsistente: no impide sincronizar el plan.
            log.warn("No se pudieron sincronizar los complementos de {}: {}", tenantId, exception.getMessage());
        }
    }

    /** target = unidades que factura Stripe. Más unidades: ya. Menos o ninguna: desde {@code effectiveAt}. */
    void apply(Map<String, Object> row, long target, Instant effectiveAt) {
        if (!"ACTIVE".equals(row.get("status"))) return;
        long units = ((Number) row.get("units")).longValue();
        Object id = row.get("id");
        if (target > units) {
            jdbc.update("update tenant_addons set units = ?, pending_units = null, pending_at = null, updated_at = now() where id = ?",
                    (int) target, id);
        } else if (target < units) {
            Instant at = effectiveAt == null ? Instant.now() : effectiveAt;
            jdbc.update("""
                    update tenant_addons set pending_units = ?, pending_at = coalesce(pending_at, ?), updated_at = now()
                    where id = ? and (pending_units is distinct from ?)
                    """, (int) target, Timestamp.from(at), id, (int) target);
        } else if (row.get("pending_units") != null) {
            jdbc.update("update tenant_addons set pending_units = null, pending_at = null, updated_at = now() where id = ?", id);
        }
    }

    /** Aplica reducciones vencidas y marca vencidos los complementos de cortesía o pago manual. */
    @Scheduled(fixedDelayString = "${billing.addons.poll-ms:300000}", initialDelayString = "${billing.addons.initial-delay-ms:90000}")
    public void applyDueChanges() {
        try {
            jdbc.update("""
                    update tenant_addons set status = case when pending_units = 0 then 'ENDED' else status end,
                      units = case when pending_units > 0 then pending_units else units end,
                      pending_units = null, pending_at = null, updated_at = now()
                    where status = 'ACTIVE' and pending_at <= now()
                    """);
            jdbc.update("update tenant_addons set status = 'EXPIRED', updated_at = now() where status = 'ACTIVE' and expires_at <= now()");
        } catch (DataAccessException exception) {
            log.warn("No se pudieron aplicar los cambios de complementos: {}", exception.getMessage());
        }
    }
}
