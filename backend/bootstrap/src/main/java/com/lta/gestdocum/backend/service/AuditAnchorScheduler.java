package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.config.AuditAnchorProperties;
import com.lta.gestdocum.backend.dto.AuditAnchorJobStatus;
import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import com.lta.gestdocum.backend.dto.AuditExternalLookup;
import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditAnchorRepository;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Anchors every tenant chain and the global chain, then publishes outside the database. */
@Service
public class AuditAnchorScheduler {

    private static final Logger log = LoggerFactory.getLogger(AuditAnchorScheduler.class);
    static final String DISABLED_MESSAGE =
            "External audit anchoring is disabled: no destination configured "
                    + "(set AUDIT_ANCHOR_EXTERNAL_FILE and/or AUDIT_ANCHOR_EXTERNAL_HTTP_URL).";

    private final AuditAnchorExternalGateway gateway;
    private final AuditAnchorService anchorService;
    private final AuditEventRepository events;
    private final AuditAnchorRepository anchors;
    private final AuditVerificationService verification;
    private final JdbcTemplate jdbc;
    private final String cron;

    private final java.util.Map<String, Long> publishedSeq = new java.util.concurrent.ConcurrentHashMap<>();
    private volatile OffsetDateTime lastRunAt;
    private volatile String lastOutcome = "NEVER_RUN";
    private volatile int lastPublished;
    private volatile int lastFailed;

    @Autowired
    public AuditAnchorScheduler(AuditAnchorExternalGateway gateway, AuditAnchorService anchorService,
                                AuditEventRepository events, AuditAnchorRepository anchors,
                                AuditVerificationService verification,
                                JdbcTemplate jdbc, AuditAnchorProperties props) {
        this(gateway, anchorService, events, anchors, verification, jdbc, props.getCron());
    }

    AuditAnchorScheduler(AuditAnchorExternalGateway gateway, AuditAnchorService anchorService,
                         AuditEventRepository events, AuditAnchorRepository anchors,
                         AuditVerificationService verification, JdbcTemplate jdbc, String cron) {
        this.verification = verification;
        this.gateway = gateway;
        this.anchorService = anchorService;
        this.events = events;
        this.anchors = anchors;
        this.jdbc = jdbc;
        this.cron = cron;
        if (gateway.isConfigured()) {
            log.info("External audit anchoring enabled (destinations: {}, cron: {})", gateway.destinationKinds(), cron);
        } else {
            log.info(DISABLED_MESSAGE);
        }
    }

    @Scheduled(cron = "${nexodocs.audit.external-anchor.cron:0 */15 * * * *}")
    public void run() {
        if (!gateway.isConfigured()) {
            return;
        }
        int published = 0;
        int failed = 0;
        List<UUID> scopes = new ArrayList<>();
        try {
            scopes.addAll(jdbc.queryForList("SELECT id FROM tenants", UUID.class));
        } catch (RuntimeException e) {
            log.warn("Audit anchor job could not list tenants: {}", e.getClass().getSimpleName());
            failed++;
        }
        scopes.add(null); // global chain
        for (UUID tenantId : scopes) {
            try {
                if (anchorScope(tenantId)) {
                    published++;
                }
            } catch (RuntimeException e) {
                failed++;
                log.warn("Audit anchor job failed for scope {}: {}", AuditExternalAnchor.scopeOf(tenantId), e.getMessage());
            }
        }
        lastRunAt = OffsetDateTime.now();
        lastPublished = published;
        lastFailed = failed;
        lastOutcome = failed > 0 ? "FAILED" : "OK";
    }

    /** @return true when a new anchor was published for the scope. */
    private boolean anchorScope(UUID tenantId) {
        Optional<AuditEvent> latest = tenantId != null
                ? events.findTopByTenantIdOrderByChainSeqDesc(tenantId)
                : events.findTopByTenantIdIsNullOrderByChainSeqDesc();
        if (latest.isEmpty()) {
            return false;
        }
        long seq = latest.get().getChainSeq();
        String scope = AuditExternalAnchor.scopeOf(tenantId);
        if (publishedSeq.getOrDefault(scope, -1L) >= seq) {
            return false;
        }
        AuditExternalLookup lookup = gateway.lookup(tenantId);
        if (lookup.status() == AuditExternalLookup.Status.FOUND && lookup.anchor().chainSeq() >= seq) {
            return false;
        }
        // Never seal a chain that already diverges from what was sealed before (or is internally broken):
        // otherwise a rewritten chain would simply supersede the honest external anchor.
        var check = verification.verifyTenantChain(tenantId);
        if (!check.valid()) {
            throw new AuditAnchorPublishException("refusing to anchor, chain verification failed: "
                    + String.valueOf(check.failureReason()).split(":")[0]);
        }
        Optional<AuditAnchor> existing = anchorService.getLatestAnchor(tenantId)
                .filter(a -> a.getChainSeq() == seq && anchorService.verifyAnchorIntegrity(a));
        AuditAnchor anchor = existing.orElseGet(() -> anchorService.createAnchor(tenantId, "LOCAL_SIGNED", null));
        int failures = gateway.publish(AuditExternalAnchor.from(anchor));
        if (failures > 0) {
            throw new AuditAnchorPublishException(failures + " destination(s) rejected the anchor");
        }
        publishedSeq.put(scope, seq);
        return true;
    }

    public AuditAnchorJobStatus status() {
        boolean configured = gateway.isConfigured();
        return new AuditAnchorJobStatus(configured, configured ? "ENABLED" : "DISABLED",
                configured ? "External audit anchoring is active." : DISABLED_MESSAGE,
                configured ? cron : null, gateway.destinationKinds(), lastRunAt, lastOutcome, lastPublished, lastFailed);
    }
}
