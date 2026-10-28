package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import com.lta.gestdocum.backend.dto.AuditExternalLookup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Endurecimiento del ancla externa: detalle sin infraestructura, escritura concurrente y secreto por defecto. */
class AuditAnchorHardeningTest {

    @TempDir
    Path dir;

    private static AuditExternalAnchor anchor(UUID tenant, long seq, String hash) {
        return new AuditExternalAnchor(1, AuditExternalAnchor.scopeOf(tenant), tenant, seq, hash,
                "LOCAL_SIGNED", "urn:nexodocs:anchor:test:" + seq, "sig" + seq, 1_700_000_000_000L + seq, null);
    }

    @Test
    @DisplayName("El detalle de un destino inalcanzable no expone host ni puerto al tenant")
    void unreachableDetailDoesNotLeakTheDestination() {
        AuditAnchorPublisher failing = new AuditAnchorPublisher() {
            @Override public String destination() { return "https://anchors.internal.example:8443"; }
            @Override public String kind() { return "http"; }
            @Override public void publish(AuditExternalAnchor anchor) { }
            @Override public boolean supportsLookup() { return true; }
            @Override public Optional<AuditExternalAnchor> latest(String scope) {
                throw new AuditAnchorPublishException("connect to anchors.internal.example:8443 refused");
            }
        };

        AuditExternalLookup lookup = new AuditAnchorExternalGateway(List.of(failing)).lookup(UUID.randomUUID());

        assertEquals(AuditExternalLookup.Status.UNREACHABLE, lookup.status());
        assertFalse(String.valueOf(lookup.detail()).contains("internal.example"));
        assertFalse(String.valueOf(lookup.detail()).contains("8443"));
        assertTrue(lookup.detail() != null && !lookup.detail().isBlank());
    }

    @Test
    @DisplayName("Dos instancias que publican la misma ancla a la vez dejan una sola linea")
    void concurrentWritersDoNotDuplicateTheSameAnchor() throws Exception {
        Path file = dir.resolve("anchors.jsonl");
        UUID tenant = UUID.randomUUID();
        AuditExternalAnchor same = anchor(tenant, 7, "c".repeat(64));
        AuditAnchorFileSink first = new AuditAnchorFileSink(file);
        AuditAnchorFileSink second = new AuditAnchorFileSink(file);
        int writers = 8;
        ExecutorService pool = Executors.newFixedThreadPool(writers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < writers; i++) {
            AuditAnchorFileSink sink = i % 2 == 0 ? first : second;
            futures.add(pool.submit(() -> {
                start.await();
                sink.publish(same);
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) f.get();
        pool.shutdown();

        assertEquals(1, Files.readAllLines(file).size());
    }

    @Test
    @DisplayName("latest() ve lo que otra instancia agrego despues sin releer lo anterior desde cero")
    void latestSeesAppendsMadeByAnotherInstance() {
        Path file = dir.resolve("anchors.jsonl");
        UUID tenant = UUID.randomUUID();
        String scope = AuditExternalAnchor.scopeOf(tenant);
        AuditAnchorFileSink reader = new AuditAnchorFileSink(file);
        AuditAnchorFileSink writer = new AuditAnchorFileSink(file);

        assertTrue(reader.latest(scope).isEmpty());
        writer.publish(anchor(tenant, 1, "a".repeat(64)));
        assertEquals(1, reader.latest(scope).orElseThrow().chainSeq());
        writer.publish(anchor(tenant, 2, "b".repeat(64)));
        assertEquals(2, reader.latest(scope).orElseThrow().chainSeq());
        assertTrue(reader.latest(AuditExternalAnchor.scopeOf(UUID.randomUUID())).isEmpty());
    }

    @Test
    @DisplayName("Si el archivo se reemplaza por uno mas corto, latest() no devuelve datos viejos")
    void latestResetsWhenTheFileIsReplaced() throws Exception {
        Path file = dir.resolve("anchors.jsonl");
        UUID tenant = UUID.randomUUID();
        String scope = AuditExternalAnchor.scopeOf(tenant);
        AuditAnchorFileSink sink = new AuditAnchorFileSink(file);
        sink.publish(anchor(tenant, 5, "a".repeat(64)));
        sink.publish(anchor(tenant, 6, "b".repeat(64)));
        assertEquals(6, sink.latest(scope).orElseThrow().chainSeq());

        Files.delete(file);
        new AuditAnchorFileSink(file).publish(anchor(tenant, 3, "d".repeat(64)));

        assertEquals(3, sink.latest(scope).orElseThrow().chainSeq());
    }

    @Test
    @DisplayName("Con el secreto por defecto y un destino configurado en prod, el arranque falla")
    void defaultSecretWithDestinationFailsInProd() {
        assertThrows(IllegalStateException.class,
                () -> AuditAnchorSecretGuard.check(AuditAnchorSecretGuard.DEFAULT_SECRET, true, true));
    }

    @Test
    @DisplayName("Un secreto propio, otro perfil o sin destino no bloquean el arranque")
    void otherCombinationsDoNotFail() {
        assertDoesNotThrow(() -> AuditAnchorSecretGuard.check("un-secreto-propio-de-produccion", true, true));
        assertDoesNotThrow(() -> AuditAnchorSecretGuard.check(AuditAnchorSecretGuard.DEFAULT_SECRET, true, false));
        assertDoesNotThrow(() -> AuditAnchorSecretGuard.check(AuditAnchorSecretGuard.DEFAULT_SECRET, false, true));
    }
}
