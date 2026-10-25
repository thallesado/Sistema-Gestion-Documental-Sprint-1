package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.config.AuditAnchorProperties;
import com.lta.gestdocum.backend.dto.AuditExternalAnchor;
import com.lta.gestdocum.backend.dto.AuditExternalLookup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Fan-out to every configured external destination and read-back for verification. */
@Service
public class AuditAnchorExternalGateway {

    private static final Logger log = LoggerFactory.getLogger(AuditAnchorExternalGateway.class);

    private final List<AuditAnchorPublisher> sinks;

    @Autowired
    public AuditAnchorExternalGateway(AuditAnchorProperties props) {
        this(build(props));
    }

    public AuditAnchorExternalGateway(List<AuditAnchorPublisher> sinks) {
        this.sinks = List.copyOf(sinks);
    }

    private static List<AuditAnchorPublisher> build(AuditAnchorProperties p) {
        List<AuditAnchorPublisher> list = new ArrayList<>();
        if (!p.getFilePath().isBlank()) {
            list.add(new AuditAnchorFileSink(Path.of(p.getFilePath())));
        }
        if (!p.getHttpUrl().isBlank()) {
            try {
                list.add(new AuditAnchorHttpSink(URI.create(p.getHttpUrl()),
                        p.getHttpReadUrl().isBlank() ? null : URI.create(p.getHttpReadUrl()),
                        p.getHttpMethod(), p.getHttpAuthHeader(),
                        Duration.ofMillis(Math.max(500, p.getHttpTimeoutMs()))));
            } catch (IllegalArgumentException e) {
                log.warn("External audit anchor HTTP sink ignored: URL must be a valid http(s) URL");
            }
        }
        return list;
    }

    public boolean isConfigured() {
        return !sinks.isEmpty();
    }

    public List<String> destinationKinds() {
        return sinks.stream().map(AuditAnchorPublisher::kind).distinct().toList();
    }

    /** Publishes to every sink. Returns the number of failures (0 = fully published). */
    public int publish(AuditExternalAnchor anchor) {
        int failures = 0;
        for (AuditAnchorPublisher s : sinks) {
            try {
                s.publish(anchor);
            } catch (RuntimeException e) {
                failures++;
                log.warn("Audit anchor publish failed for {}: {}", s.destination(), e.getMessage());
            }
        }
        return failures;
    }

    public AuditExternalLookup lookup(UUID tenantId) {
        if (sinks.isEmpty()) {
            return new AuditExternalLookup(AuditExternalLookup.Status.NOT_CONFIGURED, null, null, "No external destination configured");
        }
        String scope = AuditExternalAnchor.scopeOf(tenantId);
        AuditAnchorPublisher reader = sinks.stream().filter(AuditAnchorPublisher::supportsLookup).findFirst().orElse(null);
        if (reader == null) {
            return new AuditExternalLookup(AuditExternalLookup.Status.UNVERIFIABLE, null, sinks.get(0).kind(),
                    "Configured destinations are write-only; configure a readable destination to verify");
        }
        try {
            Optional<AuditExternalAnchor> found = reader.latest(scope);
            return found
                    .map(a -> new AuditExternalLookup(AuditExternalLookup.Status.FOUND, a, reader.kind(), null))
                    .orElseGet(() -> new AuditExternalLookup(AuditExternalLookup.Status.NONE, null, reader.kind(),
                            "No external anchor published yet for this scope"));
        } catch (RuntimeException e) {
            return new AuditExternalLookup(AuditExternalLookup.Status.UNREACHABLE, null, reader.kind(), e.getMessage());
        }
    }
}
