package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import com.lta.gestdocum.backend.dto.AuditExternalLookup;
import com.lta.gestdocum.backend.model.AuditAnchor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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
    @DisplayName("Sin AUDIT_ANCHOR_SECRET se genera una clave aleatoria fuera de la base y se reutiliza en el siguiente arranque")
    void generatesAndReusesKeyFile() throws Exception {
        Path anchors = dir.resolve("anchor-volume/anchors.jsonl");
        AuditAnchorKeyProvider first = new AuditAnchorKeyProvider("", "", anchors.toString());
        Path keyFile = dir.resolve("anchor-volume/anchor.key");
        assertTrue(Files.exists(keyFile), "la clave vive junto al archivo de anclas, no en la base");
        assertEquals(64, first.secret().length());
        assertEquals(first.secret(), new AuditAnchorKeyProvider("", "", anchors.toString()).secret());
        assertNotEquals(AuditAnchorKeyProvider.LEGACY_PUBLIC_SECRET, first.secret());
        if (Files.getFileStore(keyFile).supportsFileAttributeView("posix")) {
            assertEquals("rw-------", java.nio.file.attribute.PosixFilePermissions.toString(Files.getPosixFilePermissions(keyFile)));
        }
    }

    @Test
    @DisplayName("El antiguo valor público de AUDIT_ANCHOR_SECRET se ignora; un secreto propio se usa tal cual")
    void legacyPublicSecretIsIgnored() {
        Path keyFile = dir.resolve("k/anchor.key");
        AuditAnchorKeyProvider legacy = new AuditAnchorKeyProvider(AuditAnchorKeyProvider.LEGACY_PUBLIC_SECRET, keyFile.toString(), "");
        assertNotEquals(AuditAnchorKeyProvider.LEGACY_PUBLIC_SECRET, legacy.secret());
        assertEquals("un-secreto-propio-de-produccion-0123456789",
                new AuditAnchorKeyProvider("un-secreto-propio-de-produccion-0123456789", keyFile.toString(), "").secret());
    }

    @Test
    @DisplayName("Un ancla firmada con la clave pública solo se acepta si es anterior a su retiro")
    void legacySignedAnchorOnlyBeforeCutoff() {
        AuditAnchorService legacyService = new AuditAnchorService(null, null, AuditAnchorKeyProvider.LEGACY_PUBLIC_SECRET);
        AuditAnchorService current = new AuditAnchorService(null, null, "clave-nueva-de-la-instalacion-0123456789", true);
        UUID tenant = UUID.randomUUID();
        AuditAnchor old = signed(legacyService, tenant, AuditAnchorKeyProvider.LEGACY_KEY_RETIRED_AT.minusDays(1));
        AuditAnchor forged = signed(legacyService, tenant, AuditAnchorKeyProvider.LEGACY_KEY_RETIRED_AT.plusMinutes(1));
        assertTrue(current.verifyAnchorIntegrity(old));
        assertFalse(current.verifyAnchorIntegrity(forged));
    }

    @Test
    @DisplayName("Con un AUDIT_ANCHOR_SECRET propio nunca se acepta un ancla firmada con la clave pública, aunque esté antidatada")
    void customSecretRejectsBackdatedLegacyAnchor() {
        AuditAnchorKeyProvider custom = new AuditAnchorKeyProvider("un-secreto-propio-de-produccion-0123456789",
                dir.resolve("unused/anchor.key").toString(), "");
        assertFalse(custom.legacyFallbackAllowed());
        assertTrue(new AuditAnchorKeyProvider("", dir.resolve("gen/anchor.key").toString(), "").legacyFallbackAllowed());

        AuditAnchorService legacyService = new AuditAnchorService(null, null, AuditAnchorKeyProvider.LEGACY_PUBLIC_SECRET);
        AuditAnchorService protectedInstall = new AuditAnchorService(null, null, custom);
        AuditAnchor backdated = signed(legacyService, UUID.randomUUID(), AuditAnchorKeyProvider.LEGACY_KEY_RETIRED_AT.minusYears(1));
        assertFalse(protectedInstall.verifyAnchorIntegrity(backdated));
    }

    private static AuditAnchor signed(AuditAnchorService signer, UUID tenant, OffsetDateTime at) {
        AuditAnchor anchor = AuditAnchor.builder().tenantId(tenant).chainSeq(7L).recordHash("c".repeat(64)).anchoredAt(at).build();
        anchor.setSignature(signer.signatureFor(anchor));
        return anchor;
    }
}
