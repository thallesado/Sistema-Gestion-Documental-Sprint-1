package com.lta.gestdocum.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Control-plane state transitions and payment callback routing for isolated tenants. */
@Service
@ConditionalOnProperty(name = "app.tenant-databases.routing-enabled", havingValue = "true")
public class TenantDatabaseLifecycleService {
    private static final Logger log = LoggerFactory.getLogger(TenantDatabaseLifecycleService.class);

    private final JdbcTemplate control;
    private final TransactionTemplate controlTransaction;

    public TenantDatabaseLifecycleService(@Qualifier("controlDataSource") DataSource controlDataSource) {
        this.control = new JdbcTemplate(controlDataSource);
        this.controlTransaction = new TransactionTemplate(new DataSourceTransactionManager(controlDataSource));
    }

    /** Creates the webhook-to-tenant map before the payment gateway can emit a callback. */
    public void registerPaymentRoute(UUID tenantId, UUID transactionId) {
        if (!isIsolated(tenantId)) return;
        control.update("""
                INSERT INTO app.tenant_payment_routes(payment_transaction_id,tenant_id,expires_at)
                VALUES(?,?,now()+interval '30 minutes')
                ON CONFLICT(payment_transaction_id) DO NOTHING
                """, transactionId, tenantId);
    }

    public void updatePaymentRouteExpiry(UUID transactionId, Instant expiresAt) {
        if (expiresAt == null) return;
        control.update("UPDATE app.tenant_payment_routes SET expires_at=? WHERE payment_transaction_id=? AND consumed_at IS NULL",
                Timestamp.from(expiresAt), transactionId);
    }

    public UUID resolvePaymentTenant(UUID transactionId) {
        List<UUID> tenants = control.query("SELECT tenant_id FROM app.tenant_payment_routes WHERE payment_transaction_id=?",
                (row, index) -> row.getObject(1, UUID.class), transactionId);
        return tenants.isEmpty() ? null : tenants.getFirst();
    }

    public boolean isTenantLoginAllowed(UUID tenantId) {
        if (tenantId == null) return true;
        List<String> states = control.query("SELECT storage_mode||':'||lifecycle_state FROM app.tenant_database_registry WHERE tenant_id=?",
                (row, index) -> row.getString(1), tenantId);
        if (states.isEmpty() || states.getFirst().startsWith("LEGACY_SHARED:")) return true;
        String state = states.getFirst().substring(states.getFirst().indexOf(':') + 1);
        return "TRIAL".equals(state) || "GRACE_READ_ONLY".equals(state) || "ACTIVE".equals(state);
    }

    public boolean isIsolatedTenant(UUID tenantId) {
        return isIsolated(tenantId);
    }

    public void assertPaymentAllowed(UUID tenantId) {
        if (tenantId == null) return;
        List<String> states = control.query("SELECT lifecycle_state FROM app.tenant_database_registry WHERE tenant_id=?",
                (row, index) -> row.getString(1), tenantId);
        if (!states.isEmpty() && "DELETING".equals(states.getFirst())) {
            throw new IllegalStateException("El período de prueba finalizó y la organización está en proceso de cierre.");
        }
    }

    /** Activates the control-plane record only after the payment transaction commits. */
    public void activateAfterCommit(UUID tenantId, UUID transactionId) {
        Runnable activation = () -> controlTransaction.execute(status -> {
            int updated = control.update("""
                    UPDATE app.tenant_database_registry
                    SET lifecycle_state='ACTIVE',last_error_code=NULL,updated_at=now()
                    WHERE tenant_id=? AND storage_mode='ISOLATED'
                      AND lifecycle_state IN ('TRIAL','GRACE_READ_ONLY','ACTIVE')
                    """, tenantId);
            if (updated == 1) {
                control.update("UPDATE app.tenant_payment_routes SET consumed_at=now() WHERE payment_transaction_id=? AND tenant_id=? AND consumed_at IS NULL",
                        transactionId, tenantId);
                event(tenantId, "PAYMENT_ACTIVATED", "{\"paymentTransactionId\":\"" + transactionId + "\"}");
            }
            return null;
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { activation.run(); }
            });
        } else activation.run();
    }

    @Scheduled(fixedDelayString = "${app.tenant-databases.lifecycle-poll-ms:60000}", initialDelayString = "${app.tenant-databases.lifecycle-initial-ms:30000}")
    public void advanceTrialLifecycle() {
        try {
            controlTransaction.execute(status -> {
                List<UUID> trialEnded = control.query("""
                        UPDATE app.tenant_database_registry
                        SET lifecycle_state='GRACE_READ_ONLY',updated_at=now()
                        WHERE storage_mode='ISOLATED' AND lifecycle_state='TRIAL' AND trial_ends_at<=now()
                        RETURNING tenant_id
                        """, (row, index) -> row.getObject(1, UUID.class));
                for (UUID tenantId : trialEnded) {
                    event(tenantId, "TRIAL_ENDED", "{\"graceDays\":3}");
                    event(tenantId, "GRACE_STARTED", "{\"mode\":\"READ_ONLY\"}");
                }
                List<UUID> deletionEligible = control.query("""
                        UPDATE app.tenant_database_registry r
                        SET lifecycle_state='DELETING',deletion_started_at=now(),updated_at=now()
                        WHERE r.storage_mode='ISOLATED' AND r.lifecycle_state='GRACE_READ_ONLY'
                          AND r.grace_ends_at<=now()
                          AND NOT EXISTS (
                            SELECT 1 FROM app.tenant_payment_routes p
                            WHERE p.tenant_id=r.tenant_id AND p.consumed_at IS NULL AND p.expires_at>now()
                          )
                        RETURNING r.tenant_id
                        """, (row, index) -> row.getObject(1, UUID.class));
                for (UUID tenantId : deletionEligible) event(tenantId, "DELETION_STARTED", "{\"reason\":\"TRIAL_AND_GRACE_EXPIRED\"}");
                return null;
            });
        } catch (Exception error) {
            log.warn("Tenant lifecycle transition scan failed ({})", error.getClass().getSimpleName());
        }
    }

    private boolean isIsolated(UUID tenantId) {
        if (tenantId == null) return false;
        Integer count = control.queryForObject("SELECT count(*) FROM app.tenant_database_registry WHERE tenant_id=? AND storage_mode='ISOLATED' AND lifecycle_state IN ('TRIAL','GRACE_READ_ONLY','ACTIVE')",
                Integer.class, tenantId);
        return count != null && count == 1;
    }

    private void event(UUID tenantId, String type, String details) {
        control.update("INSERT INTO app.tenant_lifecycle_events(tenant_id,event_type,details) VALUES(?,?,?::jsonb)",
                tenantId, type, details);
    }
}
