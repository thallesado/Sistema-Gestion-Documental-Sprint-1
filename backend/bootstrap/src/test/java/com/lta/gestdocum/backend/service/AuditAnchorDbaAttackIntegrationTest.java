package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditVerificationResult;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Explicit opt-in (NEXODOCS_AUDIT_ANCHOR_IT=true) against an isolated, fully migrated scratch database.
 * Simulates the DBA attack: triggers disabled, rows rewritten, every chain hash recomputed consistently and the
 * internal anchor re-created. The internal view stays consistent; only the external file exposes the rewrite.
 */
@EnabledIfEnvironmentVariable(named = "NEXODOCS_AUDIT_ANCHOR_IT", matches = "true")
@SpringBootTest(properties = {
        "nexodocs.audit.external-anchor.cron=-",
        "backups.initial-delay-ms=3600000",
        "workflows.deadlines.initial-delay-ms=3600000"})
class AuditAnchorDbaAttackIntegrationTest {

    static final Path external;

    static {
        try {
            external = Files.createTempDirectory("nexodocs-anchor-it").resolve("anchors.jsonl");
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("nexodocs.audit.external-anchor.file-path", external::toString);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired AuditEventRepository events;
    @Autowired AuditVerificationService verification;
    @Autowired AuditAnchorService anchorService;
    @Autowired AuditAnchorScheduler scheduler;

    @Test
    void dbaRewritingChainAndInternalAnchorIsDetectedByExternalAnchor() throws Exception {
        var actor = jdbc.queryForMap("SELECT id, tenant_id FROM users WHERE email='laura@acme.com' AND deleted_at IS NULL LIMIT 1");
        UUID user = (UUID) actor.get("id");
        UUID tenant = (UUID) actor.get("tenant_id");
        for (int i = 1; i <= 3; i++) {
            jdbc.update("INSERT INTO audit_events(tenant_id,user_id,action,entity_type,result,details) VALUES(?,?,?,?,'SUCCESS',?::jsonb)",
                    tenant, user, "IT_ANCHOR_" + i, "IT", "{\"n\":" + i + "}");
        }

        scheduler.run();
        assertTrue(Files.readString(external).contains(tenant.toString()), "anchor must be published to the external file");
        AuditVerificationResult before = verification.verifyTenantChain(tenant);
        assertTrue(before.valid(), String.valueOf(before.failureReason()));
        assertEquals("ANCHORED_MATCH", before.externalAnchorStatus().status());

        jdbc.execute("ALTER TABLE audit_events DISABLE TRIGGER USER");
        try {
            jdbc.update("UPDATE audit_events SET details='{\"n\":\"FRAUD\"}'::jsonb WHERE tenant_id=? AND action='IT_ANCHOR_2'", tenant);
            List<AuditEvent> chain = events.findByTenantIdOrderByChainSeqAsc(tenant);
            String prev = null;
            for (AuditEvent e : chain) {
                if (prev != null) {
                    e.setPreviousHash(prev);
                }
                e.setRecordHash(verification.computeRecordHash(e));
                prev = e.getRecordHash();
                jdbc.update("UPDATE audit_events SET previous_hash=?, record_hash=? WHERE id=?",
                        e.getPreviousHash(), e.getRecordHash(), e.getId());
            }
            jdbc.update("DELETE FROM audit_anchors WHERE tenant_id=?", tenant);
            anchorService.createAnchor(tenant, "LOCAL_SIGNED", null); // DBA recomputes the internal anchor
        } finally {
            jdbc.execute("ALTER TABLE audit_events ENABLE TRIGGER USER");
        }

        // The internal anchor the DBA re-created is perfectly consistent with the rewritten chain.
        assertTrue(anchorService.verifyAnchorIntegrity(anchorService.getLatestAnchor(tenant).orElseThrow()));
        AuditVerificationResult after = verification.verifyTenantChain(tenant);
        assertFalse(after.valid());
        assertEquals("ANCHOR_MISMATCH", after.externalAnchorStatus().status());
        assertTrue(after.failureReason().startsWith("EXTERNAL_ANCHOR_MISMATCH"));

        int linesBefore = Files.readAllLines(external).size();
        scheduler.run();
        assertEquals(linesBefore, Files.readAllLines(external).size(), "a diverging chain must not be sealed");
    }
}
