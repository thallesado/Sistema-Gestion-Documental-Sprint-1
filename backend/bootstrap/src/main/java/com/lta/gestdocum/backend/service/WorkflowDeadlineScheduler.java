package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;

/** Periodically processes due workflow tasks through a narrowly scoped database function. */
@Component
public class WorkflowDeadlineScheduler {
    private static final Logger log = LoggerFactory.getLogger(WorkflowDeadlineScheduler.class);
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;

    public WorkflowDeadlineScheduler(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    @Scheduled(fixedDelayString = "${workflows.deadlines.poll-interval-ms:60000}", initialDelayString = "${workflows.deadlines.initial-delay-ms:30000}")
    public void processDeadlines() {
        try {
            java.util.List<UUID> isolated = jdbc.queryForList("""
                    SELECT tenant_id FROM app.tenant_database_registry
                    WHERE storage_mode='ISOLATED' AND lifecycle_state IN ('TRIAL','GRACE_READ_ONLY','ACTIVE')
                    ORDER BY tenant_id
                    """, UUID.class);
            boolean hasShared = Boolean.TRUE.equals(jdbc.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM app.tenant_database_registry WHERE storage_mode='LEGACY_SHARED')
                    """, Boolean.class));
            if (hasShared) processCurrentDatabase(null);
            for (UUID tenantId : isolated) processCurrentDatabase(tenantId);
        } catch (Exception exception) {
            // The lifecycle registry is optional until migration 059 is deployed.
            try {
                processCurrentDatabase(null);
            } catch (Exception fallbackException) {
                log.warn("Workflow deadline job could not run; verify migration 030 is applied", fallbackException);
            }
        }
    }

    private void processCurrentDatabase(UUID tenantId) {
        Integer count;
        if (tenantId == null) {
            count = processInCurrentTransaction();
        } else {
            try (TenantDatabaseContext.Scope ignored = TenantDatabaseContext.useTenant(tenantId)) {
                count = processInCurrentTransaction();
            }
        }
        if (count != null && count > 0) log.info("Workflow deadline job processed {} task(s)", count);
    }

    private Integer processInCurrentTransaction() {
        return transaction.execute(status -> {
            jdbc.execute("SET LOCAL ROLE nexodocs_app");
            return jdbc.queryForObject("SELECT app.process_workflow_deadlines()", Integer.class);
        });
    }
}
