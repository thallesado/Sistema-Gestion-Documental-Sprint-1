package com.lta.gestdocum.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

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
            Integer count = transaction.execute(status -> {
                jdbc.execute("SET LOCAL ROLE nexodocs_app");
                return jdbc.queryForObject("SELECT app.process_workflow_deadlines()", Integer.class);
            });
            if (count != null && count > 0) log.info("Workflow deadline job processed {} task(s)", count);
        } catch (Exception exception) {
            log.warn("Workflow deadline job could not run; verify migration 030 is applied", exception);
        }
    }
}
