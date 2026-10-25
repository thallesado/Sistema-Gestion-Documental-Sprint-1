package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class AuditAnchorFileSinkTest {

    @TempDir
    Path dir;

    private static AuditExternalAnchor anchor(UUID tenant, long seq, String hash) {
        return new AuditExternalAnchor(1, AuditExternalAnchor.scopeOf(tenant), tenant, seq, hash,
                "LOCAL_SIGNED", "urn:nexodocs:anchor:test:" + seq, "sig" + seq, 1_700_000_000_000L + seq, null);
    }

    @Test
    @DisplayName("Cada ancla se agrega como una linea JSON y el contenido previo nunca se trunca")
    void publish_appendsJsonLinesAndKeepsPreviousContent() throws Exception {
        Path file = dir.resolve("anchors.jsonl");
        Files.writeString(file, "{\"legacy\":true}\n");
        AuditAnchorFileSink sink = new AuditAnchorFileSink(file);
        UUID tenant = UUID.randomUUID();

        sink.publish(anchor(tenant, 1, "a".repeat(64)));
        sink.publish(anchor(tenant, 2, "b".repeat(64)));

        List<String> lines = Files.readAllLines(file);
        assertEquals(3, lines.size());
        assertEquals("{\"legacy\":true}", lines.get(0));
        assertTrue(lines.get(1).contains("\"chainSeq\":1"));
        assertTrue(lines.get(2).contains("\"recordHash\":\"" + "b".repeat(64) + "\""));
    }

    @Test
    @DisplayName("El archivo nuevo se crea con permisos restrictivos (solo propietario) y con los directorios padre faltantes")
    void publish_createsFileWithRestrictivePermissions() throws Exception {
        Path file = dir.resolve("sub/dir/anchors.jsonl");
        new AuditAnchorFileSink(file).publish(anchor(null, 1, "c".repeat(64)));

        assertTrue(Files.isRegularFile(file));
        if (Files.getFileStore(file).supportsFileAttributeView("posix")) {
            Set<PosixFilePermission> perms = Files.getPosixFilePermissions(file);
            assertEquals(Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE), perms);
        }
    }

    @Test
    @DisplayName("Rechaza un destino que es un directorio")
    void publish_refusesDirectory() {
        AuditAnchorFileSink sink = new AuditAnchorFileSink(dir);
        assertThrows(AuditAnchorPublishException.class, () -> sink.publish(anchor(null, 1, "d".repeat(64))));
    }

    @Test
    @DisplayName("Publicar dos veces la misma ancla no duplica la linea")
    void publish_isIdempotentForSameAnchor() throws Exception {
        Path file = dir.resolve("anchors.jsonl");
        AuditAnchorFileSink sink = new AuditAnchorFileSink(file);
        AuditExternalAnchor a = anchor(null, 7, "e".repeat(64));
        sink.publish(a);
        sink.publish(a);
        assertEquals(1, Files.readAllLines(file).size());
    }

    @Test
    @DisplayName("latest devuelve el ancla de mayor secuencia del alcance pedido e ignora otros tenants")
    void latest_returnsHighestSeqForScope() throws Exception {
        Path file = dir.resolve("anchors.jsonl");
        AuditAnchorFileSink sink = new AuditAnchorFileSink(file);
        UUID t1 = UUID.randomUUID();
        UUID t2 = UUID.randomUUID();
        sink.publish(anchor(t1, 3, "1".repeat(64)));
        sink.publish(anchor(t2, 9, "2".repeat(64)));
        sink.publish(anchor(t1, 5, "3".repeat(64)));
        sink.publish(anchor(null, 4, "4".repeat(64)));

        assertEquals(5, sink.latest(AuditExternalAnchor.scopeOf(t1)).orElseThrow().chainSeq());
        assertEquals(9, sink.latest(AuditExternalAnchor.scopeOf(t2)).orElseThrow().chainSeq());
        assertEquals(4, sink.latest(AuditExternalAnchor.scopeOf(null)).orElseThrow().chainSeq());
        assertEquals(Optional.empty(), sink.latest(AuditExternalAnchor.scopeOf(UUID.randomUUID())));
    }

    @Test
    @DisplayName("latest sobre un archivo inexistente es vacio, no un error")
    void latest_missingFileIsEmpty() {
        assertTrue(new AuditAnchorFileSink(dir.resolve("none.jsonl")).latest("global").isEmpty());
    }

    @Test
    @DisplayName("latest ignora lineas corruptas pero conserva las validas")
    void latest_skipsMalformedLines() throws Exception {
        Path file = dir.resolve("anchors.jsonl");
        AuditAnchorFileSink sink = new AuditAnchorFileSink(file);
        sink.publish(anchor(null, 2, "5".repeat(64)));
        Files.writeString(file, "not-json\n", StandardOpenOption.APPEND);
        assertEquals(2, sink.latest("global").orElseThrow().chainSeq());
    }
}
