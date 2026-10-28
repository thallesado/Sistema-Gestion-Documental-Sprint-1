package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditAnchorJobStatus;
import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import com.lta.gestdocum.backend.model.AuditAnchor;
import com.lta.gestdocum.backend.model.AuditEvent;
import com.lta.gestdocum.backend.repository.AuditAnchorRepository;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuditAnchorSchedulerTest {

    @TempDir
    Path dir;

    private AuditEventRepository events;
    private AuditAnchorRepository anchors;
    private AuditAnchorService anchorService;
    private JdbcTemplate jdbc;
    private AuditVerificationService verification;
    private UUID t1;
    private UUID t2;

    @BeforeEach
    void setUp() {
        events = mock(AuditEventRepository.class);
        anchors = mock(AuditAnchorRepository.class);
        anchorService = new AuditAnchorService(anchors, events, "unit-test-secret-0123456789");
        jdbc = mock(JdbcTemplate.class);
        verification = mock(AuditVerificationService.class);
        when(verification.verifyTenantChain(any())).thenReturn(ok());
        t1 = UUID.randomUUID();
        t2 = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), eq(UUID.class))).thenReturn(List.of(t1, t2));
        when(anchors.save(any(AuditAnchor.class))).thenAnswer(inv -> inv.getArgument(0));
        when(anchors.findTopByTenantIdOrderByChainSeqDesc(any())).thenReturn(Optional.empty());
        when(anchors.findTopByTenantIdIsNullOrderByChainSeqDesc()).thenReturn(Optional.empty());
        when(events.findTopByTenantIdOrderByChainSeqDesc(t1)).thenReturn(Optional.of(event(t1, 4)));
        when(events.findTopByTenantIdOrderByChainSeqDesc(t2)).thenReturn(Optional.empty());
        when(events.findTopByTenantIdIsNullOrderByChainSeqDesc()).thenReturn(Optional.of(event(null, 9)));
    }

    private static com.lta.gestdocum.backend.dto.AuditVerificationResult ok() {
        return new com.lta.gestdocum.backend.dto.AuditVerificationResult(true, null, 1, null, null, null, null, null, null, OffsetDateTime.now());
    }

    private static AuditEvent event(UUID tenant, long seq) {
        return AuditEvent.builder().tenantId(tenant).chainSeq(seq).recordHash(("ab" + seq).repeat(32).substring(0, 64)).build();
    }

    private AuditAnchorScheduler scheduler(AuditAnchorExternalGateway g) {
        return new AuditAnchorScheduler(g, anchorService, events, anchors, verification, jdbc, "0 */15 * * * *");
    }

    @Test
    @DisplayName("Sin destino configurado el job queda DISABLED con un mensaje claro y no toca nada")
    void disabled_whenNoSink() {
        AuditAnchorScheduler s = scheduler(new AuditAnchorExternalGateway(List.of()));
        s.run();
        AuditAnchorJobStatus st = s.status();
        assertFalse(st.configured());
        assertEquals("DISABLED", st.state());
        assertTrue(st.message().contains("AUDIT_ANCHOR_EXTERNAL_FILE"));
        verifyNoInteractions(anchors);
    }

    @Test
    @DisplayName("Ancla por tenant con eventos y globalmente, y las publica en el destino externo")
    void publishesPerTenantAndGlobal() {
        Path file = dir.resolve("a.jsonl");
        AuditAnchorFileSink sink = new AuditAnchorFileSink(file);
        AuditAnchorScheduler s = scheduler(new AuditAnchorExternalGateway(List.of(sink)));
        s.run();
        assertEquals(4, sink.latest(t1.toString()).orElseThrow().chainSeq());
        assertTrue(sink.latest(t2.toString()).isEmpty());
        assertEquals(9, sink.latest("global").orElseThrow().chainSeq());
        AuditAnchorJobStatus st = s.status();
        assertEquals("ENABLED", st.state());
        assertEquals(2, st.lastPublished());
        assertEquals(0, st.lastFailed());
        assertEquals(List.of("file"), st.destinationTypes());
        assertFalse(st.message().contains(dir.toString()));
    }

    @Test
    @DisplayName("Una segunda corrida sin eventos nuevos no vuelve a publicar")
    void secondRunIsNoop() {
        AuditAnchorFileSink sink = new AuditAnchorFileSink(dir.resolve("a.jsonl"));
        AuditAnchorScheduler s = scheduler(new AuditAnchorExternalGateway(List.of(sink)));
        s.run();
        s.run();
        assertEquals(0, s.status().lastPublished());
        verify(anchors, times(2)).save(any());
    }

    @Test
    @DisplayName("Un destino caido no aborta el ciclo y se cuenta como fallo")
    void failureIsReported() {
        AuditAnchorPublisher broken = new AuditAnchorPublisher() {
            public String destination() { return "http:down"; }
            public String kind() { return "http"; }
            public void publish(AuditExternalAnchor a) { throw new AuditAnchorPublishException("down"); }
        };
        AuditAnchorScheduler s = scheduler(new AuditAnchorExternalGateway(List.of(broken)));
        s.run();
        assertEquals(2, s.status().lastFailed());
        assertEquals("FAILED", s.status().lastOutcome());
    }

    @Test
    @DisplayName("No sella una cadena que ya no verifica (un reescrito no debe reemplazar el ancla honesta)")
    void refusesToAnchorDivergentChain() {
        when(verification.verifyTenantChain(any())).thenReturn(new com.lta.gestdocum.backend.dto.AuditVerificationResult(
                false, null, 1, 1L, null, "EXTERNAL_ANCHOR_MISMATCH: x", null, null, null, OffsetDateTime.now()));
        AuditAnchorFileSink sink = new AuditAnchorFileSink(dir.resolve("a.jsonl"));
        AuditAnchorScheduler s = scheduler(new AuditAnchorExternalGateway(List.of(sink)));
        s.run();
        assertTrue(sink.latest("global").isEmpty());
        assertEquals("FAILED", s.status().lastOutcome());
        verify(anchors, never()).save(any());
    }
}
