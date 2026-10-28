package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** Solo habla con un servidor HTTP local efimero; ningun servicio externo real. */
class AuditAnchorHttpSinkTest {

    private HttpServer server;
    private String base;
    private final AtomicReference<String> body = new AtomicReference<>();
    private final AtomicReference<String> auth = new AtomicReference<>();
    private final AtomicReference<String> method = new AtomicReference<>();
    private volatile int status = 200;
    private volatile String readResponse = "";
    private volatile long delayMs = 0;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/publish", ex -> {
            body.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            auth.set(ex.getRequestHeaders().getFirst("Authorization"));
            method.set(ex.getRequestMethod());
            if (delayMs > 0) {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            }
            ex.sendResponseHeaders(status, -1);
            ex.close();
        });
        server.createContext("/read", ex -> {
            byte[] bytes = readResponse.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            if (readResponse.isEmpty()) {
                ex.sendResponseHeaders(404, -1);
            } else {
                ex.sendResponseHeaders(200, bytes.length);
                ex.getResponseBody().write(bytes);
            }
            ex.close();
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private static AuditExternalAnchor anchor(long seq) {
        return new AuditExternalAnchor(1, "global", null, seq, "f".repeat(64),
                "LOCAL_SIGNED", "urn:x:" + seq, "sig", 1_700_000_000_000L, null);
    }

    @Test
    @DisplayName("Hace POST del ancla firmada como JSON con la cabecera de autorizacion configurada")
    void publish_postsSignedAnchor() {
        AuditAnchorHttpSink sink = new AuditAnchorHttpSink(URI.create(base + "/publish"), null, "POST", "Bearer s3cr3t-token", Duration.ofSeconds(2));
        sink.publish(anchor(11));
        assertEquals("POST", method.get());
        assertEquals("Bearer s3cr3t-token", auth.get());
        assertTrue(body.get().contains("\"chainSeq\":11"));
        assertTrue(body.get().contains("\"signature\":\"sig\""));
    }

    @Test
    @DisplayName("Un error HTTP falla sin filtrar secretos ni la URL completa en el mensaje")
    void publish_errorDoesNotLeakSecrets() {
        status = 500;
        AuditAnchorHttpSink sink = new AuditAnchorHttpSink(URI.create(base + "/publish?token=URLSECRET"), null, "POST", "Bearer s3cr3t-token", Duration.ofSeconds(2));
        AuditAnchorPublishException ex = assertThrows(AuditAnchorPublishException.class, () -> sink.publish(anchor(1)));
        assertTrue(ex.getMessage().contains("500"));
        assertFalse(ex.getMessage().contains("s3cr3t-token"));
        assertFalse(ex.getMessage().contains("URLSECRET"));
        assertFalse(sink.destination().contains("URLSECRET"));
    }

    @Test
    @DisplayName("Respeta el timeout configurado")
    void publish_timesOut() {
        delayMs = 1500;
        AuditAnchorHttpSink sink = new AuditAnchorHttpSink(URI.create(base + "/publish"), null, "POST", null, Duration.ofMillis(200));
        assertThrows(AuditAnchorPublishException.class, () -> sink.publish(anchor(1)));
    }

    @Test
    @DisplayName("Rechaza esquemas que no sean http/https")
    void constructor_rejectsOtherSchemes() {
        assertThrows(IllegalArgumentException.class,
                () -> new AuditAnchorHttpSink(URI.create("file:///etc/passwd"), null, "POST", null, Duration.ofSeconds(1)));
    }

    @Test
    @DisplayName("Sin URL de lectura el sink no soporta consulta; con ella devuelve el ancla de mayor secuencia")
    void latest_readsBackWhenConfigured() {
        AuditAnchorHttpSink writeOnly = new AuditAnchorHttpSink(URI.create(base + "/publish"), null, "POST", null, Duration.ofSeconds(2));
        assertFalse(writeOnly.supportsLookup());

        AuditAnchorHttpSink sink = new AuditAnchorHttpSink(URI.create(base + "/publish"), URI.create(base + "/read"), "POST", null, Duration.ofSeconds(2));
        assertTrue(sink.supportsLookup());
        assertTrue(sink.latest("global").isEmpty());

        readResponse = "[{\"version\":1,\"scope\":\"global\",\"chainSeq\":3,\"recordHash\":\"" + "a".repeat(64)
                + "\",\"anchorType\":\"LOCAL_SIGNED\",\"anchorReference\":\"r\",\"signature\":\"s\",\"anchoredAtMs\":1},"
                + "{\"version\":1,\"scope\":\"global\",\"chainSeq\":8,\"recordHash\":\"" + "b".repeat(64)
                + "\",\"anchorType\":\"LOCAL_SIGNED\",\"anchorReference\":\"r\",\"signature\":\"s\",\"anchoredAtMs\":1}]";
        assertEquals(8, sink.latest("global").orElseThrow().chainSeq());
    }
}
