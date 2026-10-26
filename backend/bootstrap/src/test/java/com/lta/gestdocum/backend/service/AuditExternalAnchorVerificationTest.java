package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import com.lta.gestdocum.backend.dto.AuditVerificationResult;
import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditAnchorRepository;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.InetAddress;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Verifies /audit/verify against the external anchor, including the "DBA rewrites everything" attack. */
class AuditExternalAnchorVerificationTest {

    @TempDir
    Path dir;

    private AuditEventRepository events;
    private AuditAnchorRepository anchors;
    private AuditAnchorService anchorService;
    private UUID tenant;
    private List<AuditAnchor> savedAnchors;

    @BeforeEach
    void setUp() {
        events = mock(AuditEventRepository.class);
        anchors = mock(AuditAnchorRepository.class);
        anchorService = new AuditAnchorService(anchors, events, "unit-test-secret-0123456789");
        tenant = UUID.randomUUID();
        savedAnchors = new ArrayList<>();
        when(anchors.save(any(AuditAnchor.class))).thenAnswer(inv -> {
            savedAnchors.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(anchors.findTopByTenantIdOrderByChainSeqDesc(tenant))
                .thenAnswer(inv -> savedAnchors.isEmpty() ? Optional.empty() : Optional.of(savedAnchors.get(savedAnchors.size() - 1)));
    }

    private AuditVerificationService service(AuditAnchorExternalGateway gateway) {
        return new AuditVerificationService(events, anchorService, gateway);
    }

    private List<AuditEvent> chain(String detailsOfSecond) throws Exception {
        AuditVerificationService helper = service(null);
        List<AuditEvent> list = new ArrayList<>();
        String prev = AuditVerificationService.GENESIS_HASH;
        for (long seq = 1; seq <= 3; seq++) {
            AuditEvent e = AuditEvent.builder().id(seq).tenantId(tenant).userId(UUID.randomUUID())
                    .action("DOCUMENT_UPDATE").entityType("DOCUMENTS").entityId(new UUID(0, seq))
                    .occurredAt(OffsetDateTime.parse("2026-10-18T14:00:00Z").plusMinutes(seq)).result("SUCCESS")
                    .ipAddress(InetAddress.getByName("127.0.0.1")).chainSeq(seq).previousHash(prev)
                    .details(seq == 2 ? detailsOfSecond : "{\"n\":" + seq + "}").build();
            e.setRecordHash(helper.computeRecordHash(e));
            prev = e.getRecordHash();
            list.add(e);
        }
        return list;
    }

    private AuditAnchorExternalGateway fileGateway() {
        return new AuditAnchorExternalGateway(List.of(new AuditAnchorFileSink(dir.resolve("anchors.jsonl"))));
    }

    private void publishLatest(AuditAnchorExternalGateway gateway, List<AuditEvent> chain) {
        when(events.findTopByTenantIdOrderByChainSeqDesc(tenant)).thenReturn(Optional.of(chain.get(chain.size() - 1)));
        AuditAnchor a = anchorService.createAnchor(tenant, "LOCAL_SIGNED", null);
        gateway.publish(AuditExternalAnchor.from(a));
    }

    @Test
    @DisplayName("Sin destino externo configurado el comportamiento previo no cambia y el estado es NOT_CONFIGURED")
    void notConfigured_keepsPreviousBehaviour() throws Exception {
        List<AuditEvent> c = chain("{\"n\":2}");
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(c);
        AuditVerificationResult r = service(new AuditAnchorExternalGateway(List.of())).verifyTenantChain(tenant);
        assertTrue(r.valid());
        assertEquals("NOT_CONFIGURED", r.externalAnchorStatus().status());
        assertFalse(r.externalAnchorStatus().anchored());
    }

    @Test
    @DisplayName("Cadena intacta con ancla externa publicada: ANCHORED_MATCH")
    void intact_matches() throws Exception {
        List<AuditEvent> c = chain("{\"n\":2}");
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(c);
        AuditAnchorExternalGateway g = fileGateway();
        publishLatest(g, c);
        AuditVerificationResult r = service(g).verifyTenantChain(tenant);
        assertTrue(r.valid());
        assertEquals("ANCHORED_MATCH", r.externalAnchorStatus().status());
        assertTrue(r.externalAnchorStatus().anchorMatchesChain());
        assertEquals(3L, r.externalAnchorStatus().anchoredChainSeq());
    }

    @Test
    @DisplayName("Configurado pero sin ancla publicada todavia: NO_EXTERNAL_ANCHOR (no es un fallo)")
    void noAnchorYet() throws Exception {
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(chain("{\"n\":2}"));
        AuditVerificationResult r = service(fileGateway()).verifyTenantChain(tenant);
        assertTrue(r.valid());
        assertEquals("NO_EXTERNAL_ANCHOR", r.externalAnchorStatus().status());
    }

    @Test
    @DisplayName("Ataque DBA: reescribir toda la cadena consistentemente y su ancla interna se detecta contra el archivo externo")
    void fullRewriteWithInternalAnchor_isDetected() throws Exception {
        AuditAnchorExternalGateway g = fileGateway();
        publishLatest(g, chain("{\"n\":2}"));

        List<AuditEvent> rewritten = chain("{\"n\":\"FRAUD\"}"); // hashes recomputed consistently
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(rewritten);
        savedAnchors.clear();
        when(events.findTopByTenantIdOrderByChainSeqDesc(tenant)).thenReturn(Optional.of(rewritten.get(2)));
        anchorService.createAnchor(tenant, "LOCAL_SIGNED", null); // DBA also recomputes the internal anchor

        // Without the external comparison the internal view is perfectly consistent.
        AuditVerificationResult internalOnly = service(null).verifyTenantChain(tenant);
        assertTrue(internalOnly.valid());

        AuditVerificationResult r = service(g).verifyTenantChain(tenant);
        assertFalse(r.valid());
        assertEquals("ANCHOR_MISMATCH", r.externalAnchorStatus().status());
        assertTrue(r.failureReason().startsWith("EXTERNAL_ANCHOR_MISMATCH"));
        assertNotEquals(r.expectedHash(), r.actualHash());
    }

    @Test
    @DisplayName("Si la cadena fue truncada por debajo del sello externo se reporta ANCHOR_MISMATCH")
    void truncatedChain_isDetected() throws Exception {
        List<AuditEvent> c = chain("{\"n\":2}");
        AuditAnchorExternalGateway g = fileGateway();
        publishLatest(g, c);
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(c.subList(0, 2));
        AuditVerificationResult r = service(g).verifyTenantChain(tenant);
        assertFalse(r.valid());
        assertEquals("ANCHOR_MISMATCH", r.externalAnchorStatus().status());
    }

    @Test
    @DisplayName("Una linea externa con firma invalida se reporta ANCHOR_SIGNATURE_INVALID")
    void forgedExternalLine_isDetected() throws Exception {
        List<AuditEvent> c = chain("{\"n\":2}");
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(c);
        AuditAnchorExternalGateway g = fileGateway();
        publishLatest(g, c);
        AuditExternalAnchor real = AuditExternalAnchor.from(savedAnchors.get(0));
        Path forged = dir.resolve("forged.jsonl");
        AuditAnchorExternalGateway g2 = new AuditAnchorExternalGateway(List.of(new AuditAnchorFileSink(forged)));
        g2.publish(new AuditExternalAnchor(1, real.scope(), real.tenantId(), 3, "9".repeat(64), real.anchorType(),
                real.anchorReference(), real.signature(), real.anchoredAtMs(), null));
        AuditVerificationResult r = service(g2).verifyTenantChain(tenant);
        assertFalse(r.valid());
        assertEquals("ANCHOR_SIGNATURE_INVALID", r.externalAnchorStatus().status());
    }

    @Test
    @DisplayName("Destino caido: UNREACHABLE, sin afirmar ni negar la integridad")
    void unreachable() throws Exception {
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(chain("{\"n\":2}"));
        AuditAnchorPublisher broken = new AuditAnchorPublisher() {
            public String destination() { return "http:down"; }
            public String kind() { return "http"; }
            public void publish(AuditExternalAnchor a) { throw new AuditAnchorPublishException("down"); }
            public boolean supportsLookup() { return true; }
            public Optional<AuditExternalAnchor> latest(String scope) { throw new AuditAnchorPublishException("down"); }
        };
        AuditVerificationResult r = service(new AuditAnchorExternalGateway(List.of(broken))).verifyTenantChain(tenant);
        assertTrue(r.valid());
        assertEquals("UNREACHABLE", r.externalAnchorStatus().status());
    }

    @Test
    @DisplayName("Solo destinos de escritura: UNVERIFIABLE")
    void writeOnlyDestination() throws Exception {
        when(events.findByTenantIdOrderByChainSeqAsc(tenant)).thenReturn(chain("{\"n\":2}"));
        AuditAnchorPublisher writeOnly = new AuditAnchorPublisher() {
            public String destination() { return "http:wo"; }
            public String kind() { return "http"; }
            public void publish(AuditExternalAnchor a) { }
        };
        AuditVerificationResult r = service(new AuditAnchorExternalGateway(List.of(writeOnly))).verifyTenantChain(tenant);
        assertEquals("UNVERIFIABLE", r.externalAnchorStatus().status());
    }
}
