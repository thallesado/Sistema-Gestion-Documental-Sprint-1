package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditExternalAnchor;

import java.util.Optional;

/** Destination outside the database's control where signed anchors are published. */
public interface AuditAnchorPublisher {

    /** Sanitized label for logs/status (no credentials, no query strings). */
    String destination();

    /** Short kind such as "file" or "http". */
    String kind();

    void publish(AuditExternalAnchor anchor);

    /** True when this destination can be read back to verify the chain against it. */
    default boolean supportsLookup() {
        return false;
    }

    /** Latest anchor (highest chainSeq) for the scope, or empty when none was published. */
    default Optional<AuditExternalAnchor> latest(String scope) {
        throw new AuditAnchorPublishException("Lookup not supported by " + destination());
    }
}
